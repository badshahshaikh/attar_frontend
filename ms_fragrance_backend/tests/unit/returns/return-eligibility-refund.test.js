import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import CreateReturnUseCase from '../../../src/modules/returns/application/use-cases/CreateReturnUseCase.js';
import UpdateReturnStatusUseCase from '../../../src/modules/returns/application/use-cases/UpdateReturnStatusUseCase.js';
import RecordRefundUseCase from '../../../src/modules/returns/application/use-cases/RecordRefundUseCase.js';
import { evaluateEligibility } from '../../../src/modules/returns/application/return-policy.js';
import { parseCreateReturn, parseRecordRefund } from '../../../src/modules/returns/returns.validator.js';

// Targeted coverage for the returns guardrail changes:
//   1. The 7-calendar-day window boundary (delivery date = day one).
//   2. Missing delivery timestamps and non-delivered orders.
//   3. Requests that exceed the remaining per-item returnable quantity.
//   4. Order-item ids from another order / duplicated items / forged prices.
//   5. Concurrent creation for the same order (row-lock serialization).
//   6. Valid and invalid status transitions.
//   7. Rejected / terminal returns blocked from refunds and stock restoration.
//   8. Refund amounts above the ceiling, duplicates and transaction rollback.

const ADMIN = { id: 1, name: 'Ops Admin' };
const DAY_MS = 24 * 60 * 60 * 1000;

// Minimal transaction shim: runs the callback with a dummy client. Any throw
// propagates (i.e. the transaction rolls back).
const withTransaction = async (cb) => cb({});

async function expectReject(promise, expectedCode) {
    try {
        await promise;
    } catch (err) {
        assert.equal(err.code, expectedCode, `expected ${expectedCode}, got ${err.code}: ${err.message}`);
        return err;
    }
    assert.fail(`expected rejection with code ${expectedCode}, but the call resolved`);
}

function readSource(relative) {
    return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

// ── Return-window fixtures ─────────────────────────────────────────────────
// Delivered on 2026-10-01 (UTC calendar date). Delivery counts as day one,
// so 2026-10-07 is the FINAL eligible day (day seven of the window) and
// 2026-10-08 is the FIRST ineligible day (day eight).
const DELIVERED_AT = '2026-10-01T00:30:00.000Z';
const ORDER_ITEMS = [
    {
        id: 11, order_id: 77, product_id: 9, product_name: 'Attar Royale',
        size: '6ml', quantity: 3, unit_price: 150, line_total: 450,
    },
];

function deliveredOrder(deliveredAt = DELIVERED_AT) {
    return { id: 77, status: 'delivered', total: 450, delivered_at: deliveredAt };
}

// ── 1. Window boundary ─────────────────────────────────────────────────────
test('1a. the delivery date itself is day one of the 7-day window', () => {
    const result = evaluateEligibility({
        order: deliveredOrder(),
        items: ORDER_ITEMS,
        now: new Date('2026-10-01T10:00:00.000Z'),
    });

    assert.equal(result.eligible, true, 'day one (the delivery date) is eligible');
    assert.equal(result.daysAfterDelivery, 0);
    assert.equal(result.daysRemaining, 7);
});

test('1b. the final eligible day is the delivery date + 6 calendar days', () => {
    const result = evaluateEligibility({
        order: deliveredOrder(),
        items: ORDER_ITEMS,
        now: new Date('2026-10-07T23:59:00.000Z'), // day seven of the window
    });

    assert.equal(result.eligible, true, 'day seven is still inside the window');
    assert.equal(result.daysAfterDelivery, 6);
    assert.equal(result.daysRemaining, 1);
});

test('1c. the first ineligible day is the delivery date + 7 calendar days', () => {
    const result = evaluateEligibility({
        order: deliveredOrder(),
        items: ORDER_ITEMS,
        now: new Date('2026-10-08T00:01:00.000Z'), // day eight
    });

    assert.equal(result.eligible, false, 'day eight is outside the window');
    assert.equal(result.daysAfterDelivery, 7);
    assert.match(result.reason, /return window closed/i);
});

test('1d. the window counts calendar days, not rolling 24-hour periods', () => {
    // Delivered just before midnight UTC: under 24-hour flooring only ~6
    // periods would have elapsed, but it is already the 8th calendar day.
    const result = evaluateEligibility({
        order: deliveredOrder('2026-10-01T23:30:00.000Z'),
        items: ORDER_ITEMS,
        now: new Date('2026-10-08T00:30:00.000Z'),
    });

    assert.equal(result.eligible, false, 'calendar-day maths close the window after 7 days');
    assert.equal(result.daysAfterDelivery, 7);
});

// ── 2. Missing delivery information / not delivered ────────────────────────
test('2a. orders that are not delivered are ineligible', () => {
    const result = evaluateEligibility({
        order: { id: 77, status: 'shipped', total: 450, delivered_at: DELIVERED_AT },
        items: ORDER_ITEMS,
        now: new Date('2026-10-02T12:00:00.000Z'),
    });

    assert.equal(result.eligible, false);
    assert.match(result.reason, /not delivered/i);
});

test('2b. delivered orders without a delivery timestamp are ineligible', () => {
    const result = evaluateEligibility({
        order: { id: 77, status: 'delivered', total: 450, delivered_at: null },
        items: ORDER_ITEMS,
        now: new Date('2026-10-02T12:00:00.000Z'),
    });

    assert.equal(result.eligible, false);
    assert.match(result.reason, /no delivery date/i);
});
// ── 3-5. Create-return guards ─────────────────────────────────────────────
// The create use case does not inject a clock, so the mock delivery stamp
// moves with the real one to stay inside the window.
function makeCreateRepo({ orderStatus = 'delivered', deliveredAt, items = ORDER_ITEMS, returnedByItem = new Map() } = {}) {
    const state = { created: null, snapshots: 0 };

    return {
        state,
        async findOrderForEligibilityTx() {
            state.snapshots += 1;
            return {
                order: {
                    id: 77, order_number: 'MSF-1', status: orderStatus, total: 450,
                    delivered_at: deliveredAt ?? new Date(Date.now() - 2 * DAY_MS).toISOString(),
                },
                items,
                returnedByItem: new Map(returnedByItem),
            };
        },
        async createReturnTx(client, payload) {
            state.created = payload;
            return 42;
        },
        async findByIdAdmin(id) {
            return { id, status: 'requested', inspected_at: null, items: [], history: [] };
        },
    };
}

function validCreatePayload(overrides = {}) {
    return {
        orderId: 77,
        items: [{ orderItemId: 11, quantity: 1 }],
        customerReason: 'Changed my mind',
        unopenedConfirmed: true,
        ...overrides,
    };
}

test('3a. a request above the remaining returnable quantity is rejected', async () => {
    // 3 ordered, 2 already returned or reserved across non-rejected returns.
    const repo = makeCreateRepo({ returnedByItem: new Map([[11, 2]]) });
    const useCase = new CreateReturnUseCase(repo, withTransaction);

    await expectReject(
        useCase.execute(validCreatePayload({ items: [{ orderItemId: 11, quantity: 2 }] }), ADMIN),
        'RETURN_QUANTITY_EXCEEDED'
    );
    assert.equal(repo.state.created, null, 'nothing is persisted when the quota is exceeded');
});

test('3b. the exact remaining quantity is accepted and priced from the order item', async () => {
    const repo = makeCreateRepo({ returnedByItem: new Map([[11, 2]]) });
    const useCase = new CreateReturnUseCase(repo, withTransaction);

    await useCase.execute(validCreatePayload({ items: [{ orderItemId: 11, quantity: 1 }] }), ADMIN);

    const line = repo.state.created.lines[0];
    assert.equal(line.quantity, 1);
    assert.equal(line.unitPrice, 150, 'unit price comes from the order item, never the client');
    assert.equal(line.productName, 'Attar Royale');
    assert.equal(line.size, '6ml');
    assert.equal(line.lineTotal, 150);
});

test('4a. order item ids belonging to a different order are rejected', async () => {
    const repo = makeCreateRepo();
    const useCase = new CreateReturnUseCase(repo, withTransaction);

    await expectReject(
        useCase.execute(validCreatePayload({ items: [{ orderItemId: 999, quantity: 1 }] }), ADMIN),
        'RETURN_ITEM_MISMATCH'
    );
    assert.equal(repo.state.created, null, 'nothing is persisted for foreign order items');
});

test('4b. an order item cannot appear twice in the same return', async () => {
    const duplicatePayload = validCreatePayload({
        items: [{ orderItemId: 11, quantity: 1 }, { orderItemId: 11, quantity: 1 }],
    });

    // The request validator rejects the duplicate outright (HTTP boundary)...
    assert.throws(() => parseCreateReturn(duplicatePayload), /listed more than once/);

    // ...and the use case refuses it even when called directly.
    const repo = makeCreateRepo();
    const useCase = new CreateReturnUseCase(repo, withTransaction);
    await expectReject(useCase.execute(duplicatePayload, ADMIN), 'RETURN_ITEM_DUPLICATE');
    assert.equal(repo.state.created, null, 'nothing is persisted for duplicated items');
});

test('4c. creation never trusts client prices and never touches totals or stock', async () => {
    const repo = makeCreateRepo();
    const useCase = new CreateReturnUseCase(repo, withTransaction);

    // Hostile payload carrying forged pricing fields: only orderItemId and
    // quantity are read; names, sizes and prices come from the DB rows.
    await useCase.execute(validCreatePayload({
        items: [{ orderItemId: 11, quantity: 1, unitPrice: 1, productName: 'Forged', lineTotal: 1 }],
    }), ADMIN);

    const line = repo.state.created.lines[0];
    assert.equal(line.unitPrice, 150, 'the forged unit price is ignored');
    assert.equal(line.productName, 'Attar Royale', 'the forged product name is ignored');
    assert.equal(line.lineTotal, 150, 'the forged line total is ignored');

    // The persistence layer must only INSERT return rows: no order totals
    // are rewritten and no product stock is deducted during creation.
    const source = readSource('../../../src/modules/returns/returns.repository.js');
    const body = source.slice(
        source.indexOf('async createReturnTx'),
        source.indexOf('── Status transition')
    );
    assert.ok(!/UPDATE\s+public\.orders/i.test(body), 'order rows (and totals) are never updated');
    assert.ok(!/UPDATE\s+public\.products|stock_quantity\s*=/i.test(body), 'stock is never deducted at creation');
});

test('5. concurrent creates for one order serialise and cannot exceed the quantity', async () => {
    // The real repository takes FOR UPDATE on the order row inside the create
    // transaction, so concurrent creates run one after another and the second
    // caller re-reads the committed quantities. Model that with a mutex held
    // for the whole (mock) transaction and a live returned-quantity store.
    let pending = Promise.resolve();
    const lock = (fn) => {
        const run = pending.then(() => fn());
        pending = run.catch(() => {});
        return run;
    };

    const live = { returned: 0, creates: 0 };
    const repo = {
        async findOrderForEligibilityTx() {
            return {
                order: {
                    id: 77, order_number: 'MSF-1', status: 'delivered', total: 450,
                    delivered_at: new Date(Date.now() - 2 * DAY_MS).toISOString(),
                },
                items: ORDER_ITEMS, // ordered quantity: 3
                returnedByItem: new Map(live.returned > 0 ? [[11, live.returned]] : []),
            };
        },
        async createReturnTx() {
            live.creates += 1;
            live.returned += 2;
            return live.creates;
        },
        async findByIdAdmin(id) {
            return { id, status: 'requested', inspected_at: null, items: [], history: [] };
        },
    };

    const serialTransaction = (cb) => lock(() => cb({}));

    const first = new CreateReturnUseCase(repo, serialTransaction)
        .execute(validCreatePayload({ items: [{ orderItemId: 11, quantity: 2 }] }), ADMIN);
    const second = new CreateReturnUseCase(repo, serialTransaction)
        .execute(validCreatePayload({ items: [{ orderItemId: 11, quantity: 2 }] }), ADMIN);

    const settled = await Promise.allSettled([first, second]);
    const fulfilled = settled.filter((r) => r.status === 'fulfilled');
    const rejected = settled.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'exactly one create wins the row lock');
    assert.equal(rejected.length, 1, 'the second create is rejected');
    assert.ok(
        ['RETURN_QUANTITY_EXCEEDED', 'RETURN_NOT_ELIGIBLE'].includes(rejected[0].reason.code),
        `unexpected rejection code: ${rejected[0].reason.code}`
    );
    assert.equal(live.creates, 1, 'only one return is persisted for the order');

    // The serialization itself lives in the repository SQL.
    const source = readSource('../../../src/modules/returns/returns.repository.js');
    const lockedRead = source.slice(
        source.indexOf('async findOrderForEligibilityTx'),
        source.indexOf('── Detail read')
    );
    assert.ok(/FOR UPDATE/.test(lockedRead), 'the eligibility snapshot locks the order row');
    assert.ok(
        /r\.status <> 'rejected'/.test(lockedRead),
        'only rejected returns are excluded from the used quantities'
    );
});

// ── 6-7. Status transitions ────────────────────────────────────────────────
function makeStatusRepo(initial = {}) {
    const state = {
        status: 'requested', inspected_at: null,
        restoreCalls: 0, confirmCalls: 0, transitions: [],
        ...initial,
    };

    return {
        state,
        async findForUpdateTx() {
            return { id: 1, status: state.status, inspected_at: state.inspected_at };
        },
        async transitionStatusTx(client, id, from, to) {
            state.transitions.push(`${from}->${to}`);
            state.status = to;
            return { id, status: to };
        },
        async confirmInspectionTx() {
            state.confirmCalls += 1;
            if (state.inspected_at) return null;
            state.inspected_at = '2026-10-12T00:00:00.000Z';
            return { id: 1, inspected_at: state.inspected_at };
        },
        async restoreStockTx() {
            state.restoreCalls += 1;
            return [{ productId: 9, quantity: 1 }];
        },
        async findByIdAdmin(id) {
            return { id, status: state.status, inspected_at: state.inspected_at, items: [], history: [] };
        },
    };
}

test('6a. the allowed transitions of the state machine are applied', async () => {
    const repo = makeStatusRepo({ status: 'requested' });
    const useCase = new UpdateReturnStatusUseCase(repo, withTransaction);

    await useCase.execute(1, { status: 'approved', note: '', inspected: false }, ADMIN);
    await useCase.execute(1, { status: 'pickup_pending', note: '', inspected: false }, ADMIN);
    await useCase.execute(1, { status: 'received', note: 'received intact', inspected: false }, ADMIN);

    assert.deepEqual(
        repo.state.transitions,
        ['requested->approved', 'approved->pickup_pending', 'pickup_pending->received']
    );
    assert.equal(repo.state.restoreCalls, 0, 'a plain status change never restores stock');
    assert.equal(repo.state.inspected_at, null, 'no inspection confirmation is written');
});

test('6b. transitions outside the allowlist are rejected', async () => {
    const repo = makeStatusRepo({ status: 'received' });
    const useCase = new UpdateReturnStatusUseCase(repo, withTransaction);

    // received -> rejected / closed are not in RETURN_TRANSITIONS.
    await expectReject(
        useCase.execute(1, { status: 'rejected', note: 'nope', inspected: false }, ADMIN),
        'RETURN_TRANSITION_INVALID'
    );
    // `refunded` may only be produced by the refund endpoint.
    await expectReject(
        useCase.execute(1, { status: 'refunded', note: '', inspected: false }, ADMIN),
        'RETURN_REFUND_VIA_ENDPOINT'
    );

    assert.equal(repo.state.status, 'received', 'the status is unchanged');
    assert.equal(repo.state.restoreCalls, 0, 'an invalid transition never restores stock');
});

test('7a. rejected returns cannot reach receipt, inspection or restoration', async () => {
    const repo = makeStatusRepo({ status: 'rejected' });
    const useCase = new UpdateReturnStatusUseCase(repo, withTransaction);

    await expectReject(
        useCase.execute(1, { status: 'received', note: '', inspected: false }, ADMIN),
        'RETURN_TRANSITION_INVALID'
    );
    await expectReject(
        useCase.execute(1, { status: 'refund_pending', note: '', inspected: false }, ADMIN),
        'RETURN_TRANSITION_INVALID'
    );
    await expectReject(
        useCase.execute(1, { status: 'rejected', note: 'still rejected', inspected: true }, ADMIN),
        'RETURN_INSPECTION_INELIGIBLE'
    );

    assert.equal(repo.state.restoreCalls, 0, 'stock is never restored for a rejected return');
    assert.equal(repo.state.confirmCalls, 0, 'inspection is never confirmed for a rejected return');
    assert.equal(repo.state.inspected_at, null);
    assert.deepEqual(repo.state.transitions, [], 'no status change happened');
});

test('7b. terminal returns admit no further changes', async () => {
    // `closed`: any movement is refused, including same-status inspection.
    const closed = makeStatusRepo({ status: 'closed' });
    const closedUc = new UpdateReturnStatusUseCase(closed, withTransaction);
    await expectReject(
        closedUc.execute(1, { status: 'closed', note: '', inspected: true }, ADMIN),
        'RETURN_TERMINAL'
    );
    await expectReject(
        closedUc.execute(1, { status: 'pickup_pending', note: '', inspected: false }, ADMIN),
        'RETURN_TERMINAL'
    );
    assert.equal(closed.state.restoreCalls, 0, 'a closed return never restores stock');
    assert.equal(closed.state.confirmCalls, 0, 'a closed return never confirms inspection');

    // `refunded`: only reachable via the refund endpoint, never movable again.
    const refunded = makeStatusRepo({ status: 'refunded' });
    const refundedUc = new UpdateReturnStatusUseCase(refunded, withTransaction);
    await expectReject(
        refundedUc.execute(1, { status: 'refunded', note: '', inspected: false }, ADMIN),
        'RETURN_REFUND_VIA_ENDPOINT'
    );
    await expectReject(
        refundedUc.execute(1, { status: 'closed', note: '', inspected: false }, ADMIN),
        'RETURN_TERMINAL'
    );
    assert.equal(refunded.state.restoreCalls, 0, 'a refunded return never restores stock');
});

test('7c. status updates are guarded against concurrent conflicting transitions', () => {
    const source = readSource('../../../src/modules/returns/returns.repository.js');
    const body = source.slice(
        source.indexOf('async transitionStatusTx'),
        source.indexOf('── Inspection confirmation')
    );

    assert.ok(/AND status = \$3/.test(body), 'the update is conditional on the expected status');
    assert.ok(/return_status_history/.test(body), 'the history row is written in the same transaction');
    assert.ok(/RETURNING id/.test(body), 'a conflicting transition reports zero rows instead of overwriting');
});

// ── 8. Refunds ─────────────────────────────────────────────────────────────
function makeRefundRepo({ status = 'refund_pending', ceiling = 500 } = {}) {
    const state = { records: [], status };

    return {
        state,
        async findForUpdateTx() {
            return { id: 5, status: state.status, inspected_at: '2026-10-12T00:00:00.000Z' };
        },
        async sumReturnLinesTx() {
            return ceiling;
        },
        async recordRefundTx(client, id, payload) {
            state.records.push(payload);
            state.status = 'refunded';
            return { id: 1, return_id: id, ...payload };
        },
        async findByIdAdmin(id) {
            return { id, status: state.status, inspected_at: null, items: [], history: [] };
        },
    };
}

test('8a. a refund above the remaining refundable amount is rejected', async () => {
    const repo = makeRefundRepo({ ceiling: 500 });
    const useCase = new RecordRefundUseCase(repo, withTransaction);

    const err = await expectReject(
        useCase.execute(5, { amount: 500.01, method: 'manual', reference: '', refundedAt: null }, ADMIN),
        'RETURN_REFUND_EXCEEDS_TOTAL'
    );
    assert.equal(err.statusCode, 422);
    assert.equal(repo.state.records.length, 0, 'no refund row is written');
    assert.equal(repo.state.status, 'refund_pending', 'the return stays refund_pending');
});

test('8b. the exact remaining refundable amount is accepted', async () => {
    const repo = makeRefundRepo({ ceiling: 500 });
    const useCase = new RecordRefundUseCase(repo, withTransaction);

    await useCase.execute(5, { amount: 500, method: 'upi', reference: '', refundedAt: null }, ADMIN);

    assert.equal(repo.state.records.length, 1, 'the single refund row is recorded');
    assert.equal(repo.state.status, 'refunded', 'the return flips to the terminal state');
});

test('8c. zero, negative and invalid refund amounts never reach the repository', async () => {
    const repo = makeRefundRepo();
    const useCase = new RecordRefundUseCase(repo, withTransaction);

    for (const amount of [0, -10, NaN, Infinity]) {
        await expectReject(
            useCase.execute(5, { amount, method: 'manual', reference: '', refundedAt: null }, ADMIN),
            'RETURN_REFUND_INVALID_AMOUNT'
        );
    }
    assert.equal(repo.state.records.length, 0, 'no refund row is written for invalid amounts');

    // The HTTP validator agrees — and also refuses non-numeric types that
    // would otherwise coerce into a money amount (Number(true) === 1).
    assert.throws(() => parseRecordRefund({ amount: 0, method: 'manual' }), /amount must be a positive number/);
    assert.throws(() => parseRecordRefund({ amount: -5, method: 'manual' }), /amount must be a positive number/);
    assert.throws(() => parseRecordRefund({ amount: 'abc', method: 'manual' }), /amount must be a positive number/);
    assert.throws(() => parseRecordRefund({ amount: true, method: 'manual' }), /amount must be a positive number/);
    assert.throws(() => parseRecordRefund({ amount: [100], method: 'manual' }), /amount must be a positive number/);
    assert.equal(parseRecordRefund({ amount: '99.999', method: 'manual' }).amount, 100, 'amounts are rounded server-side');
});

test('8d. refunds are only recorded from refund_pending', async () => {
    for (const status of ['requested', 'received', 'rejected', 'closed', 'refunded']) {
        const repo = makeRefundRepo({ status });
        const useCase = new RecordRefundUseCase(repo, withTransaction);

        await expectReject(
            useCase.execute(5, { amount: 100, method: 'manual', reference: '', refundedAt: null }, ADMIN),
            'RETURN_REFUND_WRONG_STATE'
        );
        assert.equal(repo.state.records.length, 0, `no refund row while "${status}"`);
    }
});

test('8e. a duplicate refund is rejected and the whole transaction rolls back', async () => {
    const committed = { status: 'refund_pending', refunds: [] };

    // Staging transaction: only commit when the callback resolves; a throw
    // discards every staged change (mirrors a real rollback).
    const stagingTransaction = async (cb) => {
        const staged = { status: committed.status, refunds: [...committed.refunds] };
        await cb({ staged });
        committed.status = staged.status;
        committed.refunds = staged.refunds;
    };

    const repository = {
        async findForUpdateTx() {
            return { id: 5, status: committed.status, inspected_at: '2026-10-12T00:00:00.000Z' };
        },
        async sumReturnLinesTx() {
            return 500;
        },
        async recordRefundTx(client) {
            client.staged.refunds.push({ amount: 500 }); // UNIQUE(return_id) fires on a race
            client.staged.status = 'refunded';
            throw Object.assign(
                new Error('duplicate key value violates unique constraint "return_refunds_return_id_key"'),
                { code: '23505' }
            );
        },
        async findByIdAdmin() {
            throw new Error('the success path must not be reached after a rollback');
        },
    };

    const useCase = new RecordRefundUseCase(repository, stagingTransaction);
    await expectReject(
        useCase.execute(5, { amount: 500, method: 'manual', reference: '', refundedAt: null }, ADMIN),
        'RETURN_REFUND_DUPLICATE'
    );

    assert.equal(committed.status, 'refund_pending', 'the status flip was rolled back');
    assert.equal(committed.refunds.length, 0, 'no refund row is committed');
});

test('8f. refunds never call a payment provider or touch the original order', () => {
    const stripComments = (source) => source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

    const repositoryRaw = readSource('../../../src/modules/returns/returns.repository.js');
    const useCaseSource = stripComments(readSource('../../../src/modules/returns/application/use-cases/RecordRefundUseCase.js'));
    const repositorySource = stripComments(repositoryRaw);

    assert.ok(!/razorpay/i.test(useCaseSource), 'no Razorpay usage in the refund use case');
    assert.ok(!/razorpay/i.test(repositorySource), 'no Razorpay usage in the returns repository');

    // Slice the raw source first — the section markers live in comments —
    // and only then remove the comments from the sliced region.
    const body = stripComments(repositoryRaw.slice(
        repositoryRaw.indexOf('async recordRefundTx'),
        repositoryRaw.indexOf('── Delivered stamp')
    ));
    assert.ok(!/UPDATE\s+public\.orders/i.test(body), 'the original order is never updated');
    assert.ok(!/payment_status/i.test(body), "the order's payment status is never touched");
    assert.ok(/public\.return_refunds/.test(body), 'the refund row is recorded');
});

