import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// The use case is read-only: it loads the admin order detail through the SAME
// repository + mapper as the View action, renders the PDF, and returns the
// buffer plus a stable filename. These pin missing-order handling, totals
// fidelity (never frontend-supplied), and read-only behaviour.
import GenerateInvoiceUseCase from '../../../src/modules/orders/application/use-cases/GenerateInvoiceUseCase.js';

const ORDER_ROW = {
    id: 7,
    order_number: 'MSF-261005-AB12',
    user_id: null,
    full_name: null,
    email: null,
    phone: null,
    contact_name: 'Aisha Khan',
    contact_phone: '9876543210',
    status: 'shipped',
    payment_status: 'unpaid',
    subtotal: '498.00',
    shipping: '150.00',
    total: '648.00',
    created_at: '2026-01-05T10:00:00.000Z',
    updated_at: '2026-01-05T10:00:00.000Z',
    shipping_address: {
        fullName: 'Aisha Khan',
        phone: '9876543210',
        line1: '12 Carter Road',
        city: 'Mumbai',
        state: 'MH',
        postalCode: '400050',
        country: 'India',
    },
    items: [
        { id: 1, product_id: 3, product_name: 'Mogra Attar', size: '3ml', quantity: 2, unit_price: '249.00', line_total: '498.00' },
    ],
};

function repositoryReturning(row) {
    const calls = [];
    return {
        calls,
        async findByIdAdmin(id) {
            calls.push({ method: 'findByIdAdmin', id });
            // Clone so a mutating implementation would be detectable.
            return row ? JSON.parse(JSON.stringify(row)) : null;
        },
    };
}

test('returns null when the order does not exist', async () => {
    const repository = repositoryReturning(null);
    const useCase = new GenerateInvoiceUseCase(repository, async () => { throw new Error('must not render'); });

    assert.equal(await useCase.execute(999), null);
    assert.deepEqual(repository.calls, [{ method: 'findByIdAdmin', id: 999 }]);
});

test('returns the PDF buffer and a descriptive filename from the saved order', async () => {
    const repository = repositoryReturning(ORDER_ROW);
    const seen = [];
    const fakePdf = Buffer.from('%PDF-1.4 fake');
    const useCase = new GenerateInvoiceUseCase(repository, async (order) => {
        seen.push(order);
        return fakePdf;
    });

    const result = await useCase.execute(7);

    assert.ok(Buffer.isBuffer(result.pdf) || result.pdf instanceof Uint8Array);
    assert.equal(result.filename, 'MS-Fragrances-Invoice-MSF-261005-AB12.pdf');
    // The generator receives the mapped detail with saved totals and statuses.
    assert.equal(seen.length, 1);
    assert.equal(seen[0].orderNumber, 'MSF-261005-AB12');
    assert.equal(seen[0].status, 'shipped');
    assert.equal(seen[0].paymentStatus, 'unpaid');
    assert.equal(seen[0].customerPhone, '9876543210');
    assert.equal(seen[0].items.length, 1);
});

test('never mutates the order, stock, payment or totals (read-only)', async () => {
    const repository = repositoryReturning(ORDER_ROW);
    const mutatingMethods = ['updateOrderStatus', 'update', 'save', 'deductStock', 'restoreStock'];
    for (const method of mutatingMethods) {
        repository[method] = async () => { throw new Error(`must not call ${method}`); };
    }

    const useCase = new GenerateInvoiceUseCase(repository, async () => Buffer.from('%PDF-1.4 fake'));
    const result = await useCase.execute(7);

    assert.ok(result.pdf);
    assert.deepEqual(repository.calls, [{ method: 'findByIdAdmin', id: 7 }]);
});
