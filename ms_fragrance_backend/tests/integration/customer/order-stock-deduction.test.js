import test from 'node:test';
import assert from 'node:assert/strict';
import { createCustomerOrderRepository } from '../../../src/modules/customer/customer-order.repository.js';

/**
 * Integration tests for the atomic stock reservation performed inside
 * OrderRepository.create(). A fake Postgres client models the two queries that
 * matter for inventory safety:
 *   - SELECT ... FOR UPDATE (row lock)
 *   - UPDATE ... WHERE stock_quantity >= $q AND in_stock = TRUE (conditional deduction)
 * The fake mirrors Postgres semantics: the UPDATE only returns a row when the
 * WHERE guard matches, so an overselling race (or a disabled product) produces
 * zero rows and the repository throws INSUFFICIENT_STOCK, which the transaction
 * rolls back.
 */
function buildRepository({ stockByProduct = {}, inStockByProduct = {} } = {}) {
    const events = [];

    const client = {
        async query(sqlText, values = []) {
            events.push({ kind: 'client', sqlText, values });

            if (/FROM public\.products WHERE id = \$1 FOR UPDATE/.test(sqlText)) {
                const id = Number(values[0]);
                return {
                    rows: [{
                        id,
                        name: `Product ${id}`,
                        in_stock: inStockByProduct[id] !== false,
                        stock_quantity: stockByProduct[id] ?? 0,
                    }],
                };
            }

            if (/UPDATE public\.products[\s\S]*stock_quantity = stock_quantity - \$2/.test(sqlText)) {
                const id = Number(values[0]);
                const needed = Number(values[1]);
                const current = stockByProduct[id] ?? 0;
                const enabled = inStockByProduct[id] !== false;
                if (!enabled || current < needed) {
                    return { rows: [] };
                }
                const remaining = current - needed;
                stockByProduct[id] = remaining;
                return { rows: [{ stock_quantity: remaining }] };
            }

            if (sqlText.startsWith('INSERT INTO public.orders')) {
                return { rows: [{ id: 1, order_number: values[0], status: 'placed', subtotal: values[2], shipping: values[3], total: values[4], contact_name: values[5], contact_phone: values[6], shipping_address: {}, notes: values[8], source: values[9], created_at: 'now', updated_at: 'now' }] };
            }

            if (sqlText.startsWith('INSERT INTO public.order_items')) {
                return { rows: [{ id: 1 }] };
            }

            if (/FROM public\.order_items WHERE order_id = \$1/.test(sqlText)) {
                return { rows: [] };
            }

            throw new Error(`Unexpected SQL: ${sqlText}`);
        },
    };

    let rolledBack = false;
    let committed = false;
    const withTransaction = async (fn) => {
        // Model Postgres transaction isolation: an UPDATE inside a transaction
        // is provisional until COMMIT. Snapshot the stock map so a rollback (any
        // thrown error) restores it, proving no partial deduction persists.
        const snapshot = { ...stockByProduct };
        try {
            const result = await fn(client);
            committed = true;
            return result;
        } catch (error) {
            rolledBack = true;
            for (const key of Object.keys(stockByProduct)) delete stockByProduct[key];
            Object.assign(stockByProduct, snapshot);
            throw error;
        }
    };

    const repository = createCustomerOrderRepository({ query: async () => ({ rows: [] }), withTransaction });

    return {
        repository,
        stockByProduct,
        events,
        isRolledBack: () => rolledBack,
        isCommitted: () => committed,
    };
}

const ORDER_ARGS = (lines) => ({
    orderNumber: 'MSF-000101-TEST',
    address: { fullName: 'Aisha', phone: '9876543210', line1: '1 Road', line2: null, city: 'Mumbai', state: 'MH', postalCode: '400050', country: 'India' },
    contactName: 'Aisha',
    contactPhone: '9876543210',
    notes: null,
    source: 'web',
    lines,
    subtotal: 100,
    shipping: 0,
    total: 100,
});

test('order creation locks the product row FOR UPDATE before deducting', async () => {
    const { repository, events } = buildRepository({ stockByProduct: { 3: 10 } });

    await repository.create(1, ORDER_ARGS([{ productId: 3, productName: 'Mogra', size: '3ml', quantity: 2, unitPrice: 50, lineTotal: 100 }]));

    const lockIndex = events.findIndex(e => /FOR UPDATE/.test(e.sqlText));
    const deductIndex = events.findIndex(e => /stock_quantity = stock_quantity - \$2/.test(e.sqlText));
    assert.ok(lockIndex !== -1, 'a FOR UPDATE lock must be issued');
    assert.ok(deductIndex !== -1, 'a stock deduction must be issued');
    assert.ok(lockIndex < deductIndex, 'the row must be locked before it is deducted');
});

test('a successful order deducts stock and reaches zero exactly', async () => {
    const { repository, stockByProduct } = buildRepository({ stockByProduct: { 3: 2 } });

    await repository.create(1, ORDER_ARGS([{ productId: 3, productName: 'Mogra', size: '3ml', quantity: 2, unitPrice: 50, lineTotal: 100 }]));

    assert.equal(stockByProduct[3], 0, 'stock is reduced by the purchased quantity');
});

test('stock deduction keeps positive stock when units remain', async () => {
    // The in_stock expression is (stock_quantity - qty) > 0, asserted on the SQL
    // shape so the synchronization rule is pinned without a live database.
    const { repository, events, stockByProduct } = buildRepository({ stockByProduct: { 3: 5 } });

    await repository.create(1, ORDER_ARGS([{ productId: 3, productName: 'Mogra', size: '3ml', quantity: 2, unitPrice: 50, lineTotal: 100 }]));

    const deduct = events.find(e => /stock_quantity = stock_quantity - \$2/.test(e.sqlText));
    assert.match(deduct.sqlText, /in_stock = \(stock_quantity - \$2\) > 0/);
    assert.equal(stockByProduct[3], 3);
});

test('an order exceeding available stock is rejected with INSUFFICIENT_STOCK', async () => {
    const { repository, stockByProduct, isRolledBack, isCommitted } = buildRepository({ stockByProduct: { 3: 1 } });

    await assert.rejects(
        () => repository.create(1, ORDER_ARGS([{ productId: 3, productName: 'Mogra', size: '3ml', quantity: 5, unitPrice: 50, lineTotal: 250 }])),
        (error) => {
            assert.equal(error.code, 'INSUFFICIENT_STOCK');
            assert.equal(error.statusCode, 409);
            assert.match(error.message, /only 1 unit/);
            return true;
        }
    );

    assert.equal(stockByProduct[3], 1, 'stock is NOT deducted when the guard fails');
    assert.equal(isRolledBack(), true, 'the transaction is rolled back');
    assert.equal(isCommitted(), false, 'the transaction is not committed');
});

test('no partial deduction when one of several items lacks stock', async () => {
    // First product has stock, the second does not. Because the whole thing runs
    // in one transaction that throws, neither deduction must persist.
    const { repository, stockByProduct, isRolledBack } = buildRepository({ stockByProduct: { 3: 10, 4: 1 } });

    await assert.rejects(
        () => repository.create(1, ORDER_ARGS([
            { productId: 3, productName: 'Mogra', size: '3ml', quantity: 2, unitPrice: 50, lineTotal: 100 },
            { productId: 4, productName: 'Oud', size: '3ml', quantity: 5, unitPrice: 20, lineTotal: 100 },
        ])),
        (error) => error.code === 'INSUFFICIENT_STOCK'
    );

    assert.equal(isRolledBack(), true, 'the entire transaction rolls back');
    assert.equal(stockByProduct[3], 10, 'the first product is not partially deducted');
    assert.equal(stockByProduct[4], 1, 'the second product keeps its stock');
});

test('a product with database stock_quantity = 0 is rejected with INSUFFICIENT_STOCK', async () => {
    const { repository, stockByProduct, isRolledBack } = buildRepository({ stockByProduct: { 3: 0 } });

    await assert.rejects(
        () => repository.create(1, ORDER_ARGS([{ productId: 3, productName: 'Mogra', size: '3ml', quantity: 1, unitPrice: 50, lineTotal: 50 }])),
        (error) => {
            assert.equal(error.code, 'INSUFFICIENT_STOCK');
            assert.equal(error.statusCode, 409);
            assert.match(error.message, /only 0 units left/);
            return true;
        }
    );

    assert.equal(stockByProduct[3], 0, 'zero stock stays zero');
    assert.equal(isRolledBack(), true, 'the transaction is rolled back');
});

test('a disabled product (in_stock = FALSE) cannot be deducted even with stock left', async () => {
    // The UPDATE now carries `AND in_stock = TRUE`, so an admin disabling a
    // product while it still holds units blocks the deduction atomically.
    const { repository, events, stockByProduct, isRolledBack } = buildRepository({
        stockByProduct: { 3: 10 },
        inStockByProduct: { 3: false },
    });

    await assert.rejects(
        () => repository.create(1, ORDER_ARGS([{ productId: 3, productName: 'Mogra', size: '3ml', quantity: 1, unitPrice: 50, lineTotal: 50 }])),
        (error) => {
            assert.equal(error.code, 'INSUFFICIENT_STOCK');
            assert.equal(error.statusCode, 409);
            assert.match(error.message, /currently out of stock/);
            return true;
        }
    );

    const deduct = events.find(e => /stock_quantity = stock_quantity - \$2/.test(e.sqlText));
    assert.match(deduct.sqlText, /AND in_stock = TRUE/, 'the deduction guard must require in_stock = TRUE');
    assert.equal(stockByProduct[3], 10, 'no stock was deducted for a disabled product');
    assert.equal(isRolledBack(), true, 'the transaction is rolled back');
});


test('concurrent orders on the last unit: only one succeeds, stock never goes negative', async () => {
    // Model Postgres row locking: the FOR UPDATE lock is the serialisation point.
    // Mutual exclusion in withTransaction mimics the lock, so the second order
    // cannot run until the first has fully committed.
    const stockByProduct = { 3: 1 };
    let lockHeld = false;
    const gate = [];

    const client = {
        async query(sqlText, values = []) {
            if (/FROM public\.products WHERE id = \$1 FOR UPDATE/.test(sqlText)) {
                const id = Number(values[0]);
                return { rows: [{ id, name: `Product ${id}`, in_stock: true, stock_quantity: stockByProduct[id] ?? 0 }] };
            }
            if (/UPDATE public\.products[\s\S]*stock_quantity = stock_quantity - \$2/.test(sqlText)) {
                const id = Number(values[0]);
                const needed = Number(values[1]);
                const current = stockByProduct[id] ?? 0;
                if (current < needed) return { rows: [] };
                stockByProduct[id] = current - needed;
                return { rows: [{ stock_quantity: stockByProduct[id] }] };
            }
            if (sqlText.startsWith('INSERT INTO public.orders')) {
                return { rows: [{ id: 1, order_number: values[0], status: 'placed', subtotal: values[2], shipping: values[3], total: values[4], contact_name: values[5], contact_phone: values[6], shipping_address: {}, notes: values[8], source: values[9], created_at: 'now', updated_at: 'now' }] };
            }
            if (sqlText.startsWith('INSERT INTO public.order_items')) return { rows: [{ id: 1 }] };
            if (/FROM public\.order_items WHERE order_id = \$1/.test(sqlText)) return { rows: [] };
            throw new Error(`Unexpected SQL: ${sqlText}`);
        },
    };

    const withTransaction = async (fn) => {
        while (lockHeld) {
            await new Promise((resolve) => gate.push(resolve));
        }
        lockHeld = true;
        try {
            return await fn(client);
        } finally {
            lockHeld = false;
            const next = gate.shift();
            if (next) next();
        }
    };

    const repository = createCustomerOrderRepository({ query: async () => ({ rows: [] }), withTransaction });

    const first = repository.create(1, ORDER_ARGS([{ productId: 3, productName: 'Mogra', size: '3ml', quantity: 1, unitPrice: 50, lineTotal: 50 }]));
    const second = repository.create(2, ORDER_ARGS([{ productId: 3, productName: 'Mogra', size: '3ml', quantity: 1, unitPrice: 50, lineTotal: 50 }]));

    const results = await Promise.allSettled([first, second]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'exactly one order wins the last unit');
    assert.equal(rejected.length, 1, 'the other order is rejected');
    assert.equal(rejected[0].reason.code, 'INSUFFICIENT_STOCK');
    assert.equal(stockByProduct[3], 0, 'stock never goes negative');
});

test('markPaid is idempotent and never touches stock (no double deduction on webhook retry)', async () => {
    // Stock is deducted ONLY inside create(). Payment verification / webhook
    // retries call markPaid(), which must never issue a stock UPDATE again.
    const sql = [];
    let paymentStatus = 'unpaid';

    const query = async (sqlText, values = []) => {
        sql.push(sqlText);

        if (/UPDATE public\.orders[\s\S]*payment_status = 'paid'/.test(sqlText)) {
            // Guard: only an unpaid row is updated, exactly like Postgres.
            if (paymentStatus !== 'paid') {
                paymentStatus = 'paid';
                return { rows: [{ id: values[0], payment_status: 'paid' }] };
            }
            return { rows: [] };
        }

        if (/FROM public\.orders WHERE id = \$1/.test(sqlText)) {
            return { rows: [{ id: values[0], payment_status: paymentStatus }] };
        }

        if (/FROM public\.order_items WHERE order_id = \$1/.test(sqlText)) {
            return { rows: [] };
        }

        throw new Error(`Unexpected SQL: ${sqlText}`);
    };

    const repository = createCustomerOrderRepository({ query, withTransaction: async (fn) => fn({ query }) });

    const first = await repository.markPaid({ orderId: 1, razorpayOrderId: 'order_x', razorpayPaymentId: 'pay_1' });
    const second = await repository.markPaid({ orderId: 1, razorpayOrderId: 'order_x', razorpayPaymentId: 'pay_1' });

    assert.ok(first, 'the first payment records');
    assert.ok(second, 'the duplicate payment returns the order instead of failing');

    const stockUpdates = sql.filter((s) => /UPDATE public\.products/.test(s));
    assert.equal(stockUpdates.length, 0, 'markPaid must never deduct stock');
});
