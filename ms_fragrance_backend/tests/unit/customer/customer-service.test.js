import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createCustomerService,
    buildOrderNumber,
} from '../../../src/modules/customer/customer.service.js';

const MOGRA = {
    id: 3,
    name: 'Mogra Attar',
    price: 500,
    size_pricing: { '3ml': 249, '6ml': 449 },
};

const SAVED_ADDRESS = {
    id: 11,
    full_name: 'Aisha Khan',
    phone: '9876543210',
    line1: '12 Carter Road',
    line2: null,
    city: 'Mumbai',
    state: 'MH',
    postal_code: '400050',
    country: 'India',
};

// Minimal stand-in for the repositories; `overrides` replaces any method.
function build(overrides = {}) {
    const created = [];

    const addressRepository = {
        list: async () => [],
        findById: async () => SAVED_ADDRESS,
        create: async (userId, payload) => ({ id: 99, ...payload }),
        update: async () => ({ id: 11 }),
        setDefault: async () => ({ id: 11 }),
        remove: async () => ({ id: 11, is_default: false }),
        ...overrides.addressRepository,
    };

    const orderRepository = {
        findProductsByIds: async (ids) => [MOGRA].filter((p) => ids.includes(Number(p.id))),
        list: async () => [],
        findByOrderNumber: async () => null,
        create: async (userId, payload) => {
            if (overrides.onCreate) return overrides.onCreate(payload);
            created.push(payload);
            // Mirrors the real repository, which reads the rows back from Postgres
            // and therefore returns snake_case - the service maps it to camelCase.
            return {
                id: 1,
                order_number: payload.orderNumber,
                status: 'placed',
                subtotal: payload.subtotal,
                shipping: payload.shipping,
                total: payload.total,
                contact_name: payload.contactName,
                contact_phone: payload.contactPhone,
                shipping_address: payload.address,
                notes: payload.notes,
                source: payload.source,
                created_at: '2026-10-05T10:00:00.000Z',
                updated_at: '2026-10-05T10:00:00.000Z',
                items: payload.lines.map((line, index) => ({
                    id: index + 1,
                    product_id: line.productId,
                    product_name: line.productName,
                    size: line.size,
                    quantity: line.quantity,
                    unit_price: line.unitPrice,
                    line_total: line.lineTotal,
                })),
            };
        },
        ...overrides.orderRepository,
    };

    return { service: createCustomerService({ addressRepository, orderRepository }), created };
}

test('buildOrderNumber produces MSF-YYMMDD-XXXX', () => {
    const value = buildOrderNumber(new Date(2026, 9, 5));
    assert.match(value, /^MSF-\d{6}-[0-9A-Z]{4}$/);
    assert.ok(value.startsWith('MSF-261005-'));
});

test('line pricing prefers the size price over the base price', async () => {
    const { service } = build();
    const order = await service.createOrder(1, {
        addressId: 11,
        items: [{ productId: 3, size: '3ml', quantity: 2 }],
        source: 'web',
    });

    assert.equal(order.items[0].unitPrice, 249);
    assert.equal(order.items[0].lineTotal, 498);
    assert.equal(order.subtotal, 498);
});

test('a size with no specific price falls back to the base price', async () => {
    const { service } = build();
    const order = await service.createOrder(1, {
        addressId: 11,
        items: [{ productId: 3, size: '12ml', quantity: 1 }],
        source: 'web',
    });

    assert.equal(order.items[0].unitPrice, 500);
});

test('shipping is 150 under the threshold and free above it', async () => {
    const cheap = build();
    const cheapOrder = await cheap.service.createOrder(1, {
        addressId: 11,
        items: [{ productId: 3, size: '3ml', quantity: 1 }],
        source: 'web',
    });

    assert.equal(cheap.created[0].shipping, 150);
    assert.equal(cheapOrder.subtotal, 249);
    assert.equal(cheapOrder.total, 399, '249 + 150 shipping');

    const rich = build({
        orderRepository: {
            findProductsByIds: async () => [{ id: 9, name: 'Oud', price: 9000, size_pricing: {} }],
        },
    });
    const richOrder = await rich.service.createOrder(1, {
        addressId: 11,
        items: [{ productId: 9, size: '6ml', quantity: 1 }],
        source: 'web',
    });

    assert.equal(rich.created[0].shipping, 0, 'free over 5000');
    assert.equal(richOrder.total, 9000);
});

test('a product that no longer exists is rejected', async () => {
    const { service } = build({ orderRepository: { findProductsByIds: async () => [] } });

    await assert.rejects(
        () => service.createOrder(1, {
            addressId: 11,
            items: [{ productId: 3, size: '3ml', quantity: 1 }],
            source: 'web',
        }),
        error => error.statusCode === 400 && error.code === 'PRODUCT_MISSING'
    );
});

test('an order needs either a saved address or contact details', async () => {
    const { service } = build();

    await assert.rejects(
        () => service.createOrder(1, {
            items: [{ productId: 3, size: '3ml', quantity: 1 }],
            source: 'web',
        }),
        error => error.statusCode === 400 && error.code === 'CONTACT_REQUIRED'
    );

    const order = await service.createOrder(1, {
        contactName: 'Walk In',
        contactPhone: '9876543210',
        items: [{ productId: 3, size: '3ml', quantity: 1 }],
        source: 'whatsapp',
    });

    assert.match(order.orderNumber, /^MSF-/);
});

test('a saved address is snapshotted onto the order', async () => {
    const { service, created } = build();
    await service.createOrder(1, {
        addressId: 11,
        items: [{ productId: 3, size: '3ml', quantity: 1 }],
        source: 'whatsapp',
    });

    assert.deepEqual(created[0].address, {
        fullName: 'Aisha Khan',
        phone: '9876543210',
        line1: '12 Carter Road',
        line2: null,
        city: 'Mumbai',
        state: 'MH',
        postalCode: '400050',
        country: 'India',
    });
});

test('a duplicate order number is retried', async () => {
    let attempts = 0;
    const { service } = build({
        onCreate: (payload) => {
            attempts += 1;
            if (attempts === 1) {
                const error = new Error('duplicate key');
                error.code = '23505';
                throw error;
            }
            return {
                id: 2,
                order_number: payload.orderNumber,
                total: payload.total,
                items: payload.lines.map((line, index) => ({
                    id: index + 1,
                    product_id: line.productId,
                    product_name: line.productName,
                    size: line.size,
                    quantity: line.quantity,
                    unit_price: line.unitPrice,
                    line_total: line.lineTotal,
                })),
            };
        },
    });

    const order = await service.createOrder(1, {
        addressId: 11,
        items: [{ productId: 3, size: '3ml', quantity: 1 }],
        source: 'web',
    });

    assert.equal(attempts, 2, 'the first collision should be retried');
    assert.ok(order.orderNumber);
});