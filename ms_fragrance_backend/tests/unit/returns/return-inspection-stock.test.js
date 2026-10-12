import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import UpdateReturnStatusUseCase from '../../../src/modules/returns/application/use-cases/UpdateReturnStatusUseCase.js';
import { createReturnsRepository } from '../../../src/modules/returns/returns.repository.js';
import { parseReturnStatusUpdate } from '../../../src/modules/returns/returns.validator.js';

// Targeted coverage for the return inspection / stock-restoration changes:
//   1. Approval does not restore stock.
//   2. Status = received ALONE does not restore stock.
//   3. Stock restoration is rejected without a persisted inspection confirmation
//      (and inspection is rejected for ineligible/rejected returns).
//   4. Confirmed inspection restores stock exactly once.
//   5. Repeated requests cannot restore stock twice.
//   6. Admin-disabled products stay disabled (auto-disabled stock re-opens).
//   7. A transaction failure rolls back confirmation + stock changes.
//   8. Invalid status transitions and unauthorized requests are rejected.

const ADMIN = { id: 1, name: 'Ops Admin' };

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

// Stateful mock repository: tracks status, the persisted inspection stamp and
// a restore counter so duplicate / repeated calls are observable.
function makeRepo(initial = {}) {
    const state = {
        status: 'requested',
        inspected_at: null,
        restoreCalls: 0,
        confirmCalls: 0,
        transitions: [],
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
            return [{ productId: 9, quantity: 2 }];
        },
        async findByIdAdmin(id) {
            return { id, status: state.status, inspected_at: state.inspected_at, items: [], history: [] };
        },
    };
}

// Fake SQL client that models the `return_items` / `products` rows so we can
// observe the exactly-once guard and the in_stock behaviour. The product
// UPDATE mirrors the repository's CASE: in_stock flips to TRUE only when it
// was FALSE at zero stock. Every statement is recorded for SQL assertions.
function buildRestoreClient(store) {
    store.queries = [];
    return {
        query: async (sql, values = []) => {
            store.queries.push({ sql, values });

            if (/SELECT inspected_at FROM public\.returns/.test(sql)) {
                return { rows: [{ inspected_at: store.inspected_at }] };
            }
            if (/SELECT ri\.id, ri\.product_id, ri\.quantity/.test(sql)) {
                return {
                    rows: store.items
                        .filter((i) => !i.stock_restored)
                        .map((i) => ({ id: i.id, product_id: i.product_id, quantity: i.quantity })),
                };
            }
            if (/UPDATE public\.return_items/.test(sql)) {
                const item = store.items.find((i) => i.id === values[0]);
                if (item && !item.stock_restored) item.stock_restored = true;
                return { rows: [] };
            }
            if (/SELECT id FROM public\.products/.test(sql)) {
                const p = store.products.find((x) => x.id === values[0]);
                return { rows: p ? [{ id: p.id }] : [] };
            }
            if (/UPDATE public\.products/.test(sql)) {
                const p = store.products.find((x) => x.id === values[0]);
                const qty = Number(values[1]);
                const autoDisabled = p.in_stock === false && p.stock_quantity === 0;
                p.stock_quantity += qty;
                if (autoDisabled) p.in_stock = true;
                return { rows: [] };
            }
            throw new Error(`Unexpected query in restore test: ${sql}`);
        },
    };
}


// ── 1. Approval does not restore stock ─────────────────────────────────────
test('1. approving a return never restores stock', async () => {
    const repo = makeRepo({ status: 'requested' });
    const useCase = new UpdateReturnStatusUseCase(repo, withTransaction);

    const result = await useCase.execute(1, { status: 'approved', note: '', inspected: false }, ADMIN);

    assert.equal(repo.state.status, 'approved', 'the approval transition is applied');
    assert.equal(repo.state.restoreCalls, 0, 'restore must not run on approval');
    assert.equal(repo.state.confirmCalls, 0, 'inspection must not be confirmed on approval');
    assert.equal(repo.state.inspected_at, null, 'no inspection stamp is written');
    assert.deepEqual(result.stockRestored, [], 'no stock lines are returned as restored');
});

// ── 2. received ALONE does not restore stock ───────────────────────────────
test('2. setting the status to received alone does not restore stock', async () => {
    const repo = makeRepo({ status: 'pickup_pending' });
    const useCase = new UpdateReturnStatusUseCase(repo, withTransaction);

    const result = await useCase.execute(1, { status: 'received', note: '', inspected: false }, ADMIN);

    assert.equal(repo.state.status, 'received', 'the status still moves to received');
    assert.equal(repo.state.restoreCalls, 0, 'received alone must not restore stock');
    assert.equal(repo.state.confirmCalls, 0, 'no inspection confirmation is persisted');
    assert.equal(repo.state.inspected_at, null, 'inspected_at stays NULL without confirmation');
    assert.deepEqual(result.stockRestored, [], 'nothing is restored');
});

// ── 3. Restoration rejected without inspection confirmation ────────────────
test('3. stock restoration is rejected without a persisted inspection confirmation', async () => {
    // (a) Repository guard: restoreStockTx refuses to run when inspected_at
    //     is NULL, so there is no lawful path past the persistence layer.
    const repository = createReturnsRepository({ query: async () => ({ rows: [] }), withTransaction });
    const client = {
        query: async (sql) => {
            if (/SELECT inspected_at FROM public\.returns/.test(sql)) {
                return { rows: [{ inspected_at: null }] };
            }
            throw new Error('no further statement may run without a confirmation');
        },
    };
    const err = await expectReject(repository.restoreStockTx(client, 1), 'RETURN_INSPECTION_REQUIRED');
    assert.equal(err.statusCode, 422);

    // (b) Use case: inspection cannot be confirmed for a rejected return.
    const rejected = makeRepo({ status: 'rejected' });
    const useCase = new UpdateReturnStatusUseCase(rejected, withTransaction);
    await expectReject(
        useCase.execute(1, { status: 'rejected', note: 'duplicate', inspected: true }, ADMIN),
        'RETURN_INSPECTION_INELIGIBLE'
    );
    assert.equal(rejected.state.restoreCalls, 0, 'no restore for an ineligible return');
    assert.equal(rejected.state.confirmCalls, 0, 'no confirmation for an ineligible return');
});


// ── 4. Confirmed inspection restores stock once ────────────────────────────
test('4. an explicit inspection confirmation persists and restores stock exactly once', async () => {
    const repo = makeRepo({ status: 'pickup_pending' });
    const useCase = new UpdateReturnStatusUseCase(repo, withTransaction);

    const result = await useCase.execute(1, { status: 'received', note: '', inspected: true }, ADMIN);

    assert.equal(repo.state.status, 'received');
    assert.equal(repo.state.confirmCalls, 1, 'confirmation persisted exactly once');
    assert.ok(repo.state.inspected_at, 'inspected_at is written inside the transaction');
    assert.equal(repo.state.restoreCalls, 1, 'stock restored exactly once');
    assert.equal(result.stockRestored.length, 1, 'one restored line is reported');
    assert.equal(result.inspectedAt, '2026-10-12T00:00:00.000Z', 'the admin mapper exposes inspectedAt');
});

// ── 5. Repeated requests cannot restore stock twice ────────────────────────
test('5. a repeated confirmation request cannot restore stock twice', async () => {
    const repo = makeRepo({ status: 'pickup_pending' });
    const useCase = new UpdateReturnStatusUseCase(repo, withTransaction);

    await useCase.execute(1, { status: 'received', note: '', inspected: true }, ADMIN);
    assert.equal(repo.state.restoreCalls, 1);

    // Second request: the return is already received AND already inspected.
    await expectReject(
        useCase.execute(1, { status: 'received', note: '', inspected: true }, ADMIN),
        'RETURN_ALREADY_INSPECTED'
    );
    assert.equal(repo.state.restoreCalls, 1, 'stock is never restored a second time');
    assert.equal(repo.state.confirmCalls, 1, 'the confirmation is never applied twice');

    // Repository-level belt-and-braces: even a direct second restoreStockTx
    // call skips lines already flagged stock_restored = TRUE.
    const store = {
        inspected_at: '2026-10-12T00:00:00.000Z',
        items: [{ id: 1, product_id: 9, quantity: 2, stock_restored: false }],
        products: [{ id: 9, stock_quantity: 0, in_stock: true }],
    };
    const repository = createReturnsRepository({ query: async () => ({ rows: [] }), withTransaction });
    const client = buildRestoreClient(store);
    const first = await repository.restoreStockTx(client, 1);
    const second = await repository.restoreStockTx(client, 1);

    assert.equal(first.length, 1, 'the first restore processes the line');
    assert.equal(second.length, 0, 'the second restore processes nothing');
    assert.equal(store.products[0].stock_quantity, 2, 'stock added exactly once');
});

// ── 6. Disabled products remain disabled ───────────────────────────────────
test('6. an admin-disabled product stays disabled while auto-disabled stock re-opens', async () => {
    const store = {
        inspected_at: '2026-10-12T00:00:00.000Z',
        items: [
            { id: 1, product_id: 9, quantity: 2, stock_restored: false },  // admin disabled, still holds units
            { id: 2, product_id: 10, quantity: 3, stock_restored: false }, // auto-disabled at zero stock
        ],
        products: [
            { id: 9, stock_quantity: 5, in_stock: false },   // intentional admin disable
            { id: 10, stock_quantity: 0, in_stock: false },  // sold out (checkout flipped it off)
        ],
    };
    const repository = createReturnsRepository({ query: async () => ({ rows: [] }), withTransaction });
    const restored = await repository.restoreStockTx(buildRestoreClient(store), 1);

    assert.equal(restored.length, 2, 'both eligible lines are restored');

    const adminDisabled = store.products.find((p) => p.id === 9);
    const autoDisabled = store.products.find((p) => p.id === 10);

    assert.equal(adminDisabled.in_stock, false, 'intentional admin disable is preserved');
    assert.equal(adminDisabled.stock_quantity, 7, 'units are still returned to inventory');
    assert.equal(autoDisabled.in_stock, true, 'auto-disabled (zero stock) product becomes available again');
    assert.equal(autoDisabled.stock_quantity, 3, 'units are returned to inventory');

    // The persisted SQL must never blindly set in_stock = TRUE.
    const productUpdate = store.queries.find((q) => /UPDATE public\.products/.test(q.sql));
    assert.ok(/in_stock = CASE/.test(productUpdate.sql), 'in_stock is updated via a guarded CASE');
    assert.ok(
        /WHEN in_stock = FALSE AND stock_quantity = 0 THEN TRUE/.test(productUpdate.sql),
        'only a zero-stock auto-disable is re-opened'
    );
    assert.ok(!/in_stock\s*=\s*TRUE/.test(productUpdate.sql), 'never unconditionally sets in_stock = TRUE');
});


// ── 7. Transaction failure rolls back ──────────────────────────────────────
test('7. a transaction failure rolls back both the confirmation and the stock change', async () => {
    const committed = { inspected_at: null, stock: 5 };

    // Transaction shim that only commits if the callback resolves; a throw
    // discards every staged change (mirrors a real rollback).
    const stagingTransaction = async (cb) => {
        const staged = { inspected_at: committed.inspected_at, stock: committed.stock };
        await cb({ staged });
        committed.inspected_at = staged.inspected_at;
        committed.stock = staged.stock;
    };

    const repository = {
        async findForUpdateTx() {
            return { id: 1, status: 'pickup_pending', inspected_at: committed.inspected_at };
        },
        async transitionStatusTx() {
            return { id: 1 };
        },
        async confirmInspectionTx(client) {
            client.staged.inspected_at = 'INSPECTED';
            return { inspected_at: 'INSPECTED' };
        },
        async restoreStockTx(client) {
            client.staged.stock += 2;
            throw new Error('boom');
        },
        async findByIdAdmin() {
            throw new Error('the success path must not be reached after a rollback');
        },
    };

    const useCase = new UpdateReturnStatusUseCase(repository, stagingTransaction);

    try {
        await useCase.execute(1, { status: 'received', note: '', inspected: true }, ADMIN);
        assert.fail('expected the transaction to fail');
    } catch (err) {
        assert.equal(err.message, 'boom', 'the failure propagates to the caller');
    }

    assert.equal(committed.inspected_at, null, 'the inspection confirmation was rolled back');
    assert.equal(committed.stock, 5, 'the stock change was rolled back');
});

// ── 8. Invalid transitions + unauthorized requests rejected ────────────────
test('8a. invalid status transitions are rejected', async () => {
    const repo = makeRepo({ status: 'received' });
    const useCase = new UpdateReturnStatusUseCase(repo, withTransaction);

    // received -> closed is not in RETURN_TRANSITIONS.
    const err = await expectReject(
        useCase.execute(1, { status: 'closed', note: '', inspected: false }, ADMIN),
        'RETURN_TRANSITION_INVALID'
    );
    assert.equal(err.statusCode, 422);
    assert.equal(repo.state.restoreCalls, 0, 'an invalid transition never restores stock');

    // `refunded` may only be produced by the refund endpoint.
    await expectReject(
        useCase.execute(1, { status: 'refunded', note: '', inspected: false }, ADMIN),
        'RETURN_REFUND_VIA_ENDPOINT'
    );
});

test('8b. the status endpoint requires authentication and the admin role', () => {
    const routesSource = readFileSync(
        fileURLToPath(new URL('../../../src/modules/returns/returns.routes.js', import.meta.url)),
        'utf8'
    );
    const statusRoute = routesSource.split(/\r?\n/).find((line) => line.includes("patch('/:id/status'"));

    assert.ok(statusRoute, 'the status route is registered');
    assert.ok(statusRoute.includes('authenticate'), 'the status route authenticates the caller');
    assert.ok(statusRoute.includes('requireAdmin'), 'the status route requires the admin role');
});

// ── Server-side validation of the inspection flag ──────────────────────────
test('the server validates the inspected flag instead of trusting the frontend', () => {
    assert.equal(parseReturnStatusUpdate({ status: 'received' }).inspected, false, 'an omitted flag means false');
    assert.equal(parseReturnStatusUpdate({ status: 'received', inspected: true }).inspected, true);
    assert.equal(parseReturnStatusUpdate({ status: 'received', inspected: 'true' }).inspected, true, 'string true is accepted');
    assert.equal(parseReturnStatusUpdate({ status: 'received', inspected: false }).inspected, false);
    assert.throws(() => parseReturnStatusUpdate({ status: 'received', inspected: 'yes' }), /inspected must be a boolean/);
    assert.throws(() => parseReturnStatusUpdate({ status: 'received', inspected: 1 }), /inspected must be a boolean/);
});

