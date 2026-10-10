import test from 'node:test';
import assert from 'node:assert/strict';

import UpdateOrderStatusUseCase from '../../../src/modules/orders/application/use-cases/UpdateOrderStatusUseCase.js';
import { createCustomerOrderRepository } from '../../../src/modules/customer/customer-order.repository.js';

function orderRow(overrides = {}) {
    return {
        id: 7,
        order_number: 'MSF-261005-ABCD',
        user_id: null,
        status: 'placed',
        payment_status: 'unpaid',
        subtotal: 498,
        shipping: 150,
        total: 648,
        contact_name: 'Aisha Khan',
        contact_phone: '9876543210',
        shipping_address: { fullName: 'Aisha Khan', line1: '12 Carter Road', city: 'Mumbai', state: 'MH', postalCode: '400050', country: 'India' },
        notes: null,
        source: 'web',
        created_at: '2026-10-05T10:00:00.000Z',
        updated_at: '2026-10-05T10:00:00.000Z',
        items: [],
        ...overrides,
    };
}

// ── Use case: independent fields, 404 mapping ─────────────────────────────
test('use case updates the general order status and returns the mapped order', async () => {
    const seen = [];
    const repository = {
        updateOrderStatus: async (id, fields) => {
            seen.push({ id, fields });
            return orderRow({ status: fields.status });
        },
    };

    const useCase = new UpdateOrderStatusUseCase(repository);
    const order = await useCase.execute(7, { status: 'shipped' });

    assert.equal(seen[0].id, 7);
    assert.equal(seen[0].fields.status, 'shipped', 'only the order status is sent to the repository');
    assert.equal(seen[0].fields.paymentStatus, undefined, 'payment status is not touched');
    assert.equal(order.orderNumber, 'MSF-261005-ABCD');
    assert.equal(order.status, 'shipped');
    // Payment status must be untouched when only the order status changes.
    assert.equal(order.paymentStatus, 'unpaid');
});

test('use case updates the payment status independently and leaves the order status alone', async () => {
    const repository = {
        updateOrderStatus: async (id, fields) => orderRow({ payment_status: fields.paymentStatus }),
    };

    const useCase = new UpdateOrderStatusUseCase(repository);
    const order = await useCase.execute(7, { paymentStatus: 'paid' });

    assert.equal(order.paymentStatus, 'paid');
    // General order status must not change when only payment status is set.
    assert.equal(order.status, 'placed');
});

test('use case returns null when the order does not exist (controller turns it into 404)', async () => {
    const repository = { updateOrderStatus: async () => null };
    const useCase = new UpdateOrderStatusUseCase(repository);

    assert.equal(await useCase.execute(999, { status: 'shipped' }), null);
});

// ── Repository: single-column, parameterized, independent SQL ──────────────
function buildStatusRepository(rows = {}) {
    const queries = [];
    const existing = { ...rows };

    const query = async (sql, values = []) => {
        queries.push({ sql, values });

        if (/UPDATE public\.orders/.test(sql)) {
            const id = values[values.length - 1];
            return { rows: existing[id] ? [{ id }] : [] };
        }
        if (/FROM public\.orders o[\s\S]*WHERE o\.id = \$1/.test(sql)) {
            const id = values[0];
            return { rows: existing[id] ? [orderRow(existing[id])] : [] };
        }
        if (/FROM public\.order_items WHERE order_id/.test(sql)) {
            return { rows: [] };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
    };

    const repository = createCustomerOrderRepository({ query, withTransaction: async (fn) => fn({ query }) });
    return { repository, queries, existing };
}

test('repository updates only the status column when paymentStatus is absent', async () => {
    const { repository, queries } = buildStatusRepository({ 7: {} });

    await repository.updateOrderStatus(7, { status: 'shipped' });

    const update = queries.find(q => /UPDATE public\.orders/.test(q.sql));
    assert.ok(/status = \$1/.test(update.sql), 'status is bound as $1');
    assert.ok(!/payment_status/.test(update.sql), 'payment_status is NOT in the SET clause');
    assert.equal(update.values[0], 'shipped', 'the status value is a bind parameter');
    assert.equal(update.values[update.values.length - 1], 7, 'the id is the final bind parameter');
});

test('repository updates only the payment_status column when status is absent', async () => {
    const { repository, queries } = buildStatusRepository({ 7: {} });

    await repository.updateOrderStatus(7, { paymentStatus: 'paid' });

    const update = queries.find(q => /UPDATE public\.orders/.test(q.sql));
    assert.ok(/payment_status = \$1/.test(update.sql), 'payment_status is bound as $1');
    // Only the column name "status" appears inside payment_status; a bare
    // "status =" assignment for the general status must not be present.
    assert.ok(!/(^|[ ,])status = \$/.test(update.sql), 'the general status column is NOT updated');
    assert.equal(update.values[0], 'paid');
});

test('repository never touches stock, totals or razorpay columns', async () => {
    const { repository, queries } = buildStatusRepository({ 7: {} });

    await repository.updateOrderStatus(7, { status: 'cancelled' });

    const update = queries.find(q => /UPDATE public\.orders/.test(q.sql));
    assert.ok(!/stock/.test(update.sql), 'no stock change');
    assert.ok(!/subtotal|shipping|total/.test(update.sql), 'no totals change');
    assert.ok(!/razorpay/.test(update.sql), 'no razorpay change');
});

test('repository returns null when no order matches the id', async () => {
    const { repository } = buildStatusRepository({}); // no order 999

    assert.equal(await repository.updateOrderStatus(999, { status: 'shipped' }), null);
});

test('repository re-reads the order through the admin query after updating', async () => {
    const { repository, queries } = buildStatusRepository({ 7: { status: 'shipped', payment_status: 'unpaid' } });

    const order = await repository.updateOrderStatus(7, { status: 'shipped' });

    const reread = queries.find(q => /FROM public\.orders o[\s\S]*WHERE o\.id = \$1/.test(q.sql));
    assert.ok(reread, 'the updated row is read back with the admin join');
    // The repository returns raw rows (snake_case); camelCase mapping happens in
    // the use case. The preserved payment status is returned untouched here.
    assert.equal(order.status, 'shipped');
    assert.equal(order.payment_status, 'unpaid', 'the preserved payment status is returned');
    assert.ok(Array.isArray(order.items), 'items are stitched onto the order');
});

// ── Existing admin filters remain intact and independent ──────────────────
test('findAllAdmin filters by status and payment_status independently (unchanged behavior)', async () => {
    const queries = [];
    const rows = [orderRow({ id: 7, status: 'shipped', payment_status: 'paid' })];
    const query = async (sql, values = []) => {
        queries.push({ sql, values });
        if (/COUNT\(\*\)/.test(sql)) return { rows: [{ total: 1 }] };
        if (/FROM public\.orders o[\s\S]*LIMIT/.test(sql)) return { rows };
        throw new Error(`Unexpected SQL: ${sql}`);
    };

    const repository = createCustomerOrderRepository({ query, withTransaction: async (fn) => fn({ query }) });
    const result = await repository.findAllAdmin({ status: 'shipped', paymentStatus: 'paid', page: 1, limit: 10 });

    const listQuery = queries.find(q => /FROM public\.orders o[\s\S]*LIMIT/.test(q.sql));
    assert.ok(/o\.status = \$1/.test(listQuery.sql), 'status filter is applied');
    assert.ok(/o\.payment_status = \$2/.test(listQuery.sql), 'payment filter is applied and independent');
    assert.deepEqual(listQuery.values.slice(0, 2), ['shipped', 'paid']);
    assert.deepEqual(listQuery.values.slice(2), [10, 0], 'limit and offset follow the filters');
    assert.equal(result.total, 1);
});

test('findAllAdmin still searches by order number and contact name', async () => {
    const queries = [];
    const query = async (sql) => {
        queries.push({ sql, values: [] });
        if (/COUNT\(\*\)/.test(sql)) return { rows: [{ total: 0 }] };
        return { rows: [] };
    };

    const repository = createCustomerOrderRepository({ query, withTransaction: async (fn) => fn({ query }) });
    await repository.findAllAdmin({ search: 'Aisha', page: 1, limit: 10 });

    const countQuery = queries.find(q => /COUNT\(\*\)/.test(q.sql));
    assert.ok(/o\.order_number ILIKE/.test(countQuery.sql), 'order number search retained');
    assert.ok(/o\.contact_name ILIKE/.test(countQuery.sql), 'guest contact_name search retained');
});
