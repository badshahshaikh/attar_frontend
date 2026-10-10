import test from 'node:test';
import assert from 'node:assert/strict';

import { createCustomerService } from '../../../src/modules/customer/customer.service.js';

const MOGRA = {
    id: 3,
    name: 'Mogra Attar',
    price: 500,
    size_pricing: { '3ml': 249, '6ml': 449 },
    in_stock: true,
    stock_quantity: 10,
};

const GUEST_PAYLOAD = {
    address: {
        fullName: 'Aisha Khan',
        phone: '9876543210',
        line1: '12 Carter Road',
        line2: null,
        city: 'Mumbai',
        state: 'MH',
        postalCode: '400050',
        country: 'India',
        email: 'aisha@example.com',
    },
    contactName: 'Aisha Khan',
    contactPhone: '9876543210',
    notes: null,
    source: 'web',
    items: [{ productId: 3, size: '3ml', quantity: 2 }],
};

// Minimal stand-in repositories, mirroring customer-service.test.js so a guest
// order travels the exact same persistOrder() path as a signed-in one.
function build(overrides = {}) {
    const created = [];
    const createCalls = [];

    const orderRepository = {
        findProductsByIds: async (ids) => [MOGRA].filter((p) => ids.includes(Number(p.id))),
        create: async (userId, payload) => {
            createCalls.push({ userId, payload });
            created.push(payload);
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
                payment_status: 'unpaid',
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

    const addressRepository = {
        list: async () => [],
        // Used only by the createOrder sanity check (saved-address resolution);
        // guests never touch the address repository.
        findById: async () => ({
            id: 11,
            full_name: 'Aisha Khan',
            phone: '9876543210',
            line1: '12 Carter Road',
            line2: null,
            city: 'Mumbai',
            state: 'MH',
            postal_code: '400050',
            country: 'India',
        }),
    };

    return {
        service: createCustomerService({ addressRepository, orderRepository }),
        created,
        createCalls,
    };
}

test('createGuestOrder records the order with a null user_id (no account needed)', async () => {
    const { service, createCalls } = build();
    const order = await service.createGuestOrder(GUEST_PAYLOAD);

    assert.equal(createCalls[0].userId, null, 'guest orders carry no user_id');
    assert.match(order.orderNumber, /^MSF-\d{6}-[0-9A-Z]{4}$/);
    assert.equal(order.contactName, 'Aisha Khan');
    assert.equal(order.contactPhone, '9876543210');
    assert.equal(order.shippingAddress.city, 'Mumbai');
    assert.equal(order.shippingAddress.postalCode, '400050');
    assert.equal(order.paymentStatus, 'unpaid');
});

test('createGuestOrder computes prices/totals on the backend, ignoring client values', async () => {
    const { service, created } = build();
    const order = await service.createGuestOrder({
        ...GUEST_PAYLOAD,
        // A tampered client tries to undercut the price and totals.
        subtotal: 1,
        shipping: 0,
        total: 1,
        items: [{ productId: 3, size: '3ml', quantity: 2, unitPrice: 1, lineTotal: 2 }],
    });

    // 2 × ₹249 (size price) = ₹498 subtotal, + ₹150 shipping = ₹648 total.
    assert.equal(order.items[0].unitPrice, 249, 'size price from the products table');
    assert.equal(order.items[0].lineTotal, 498);
    assert.equal(order.subtotal, 498);
    assert.equal(order.shipping, 150);
    assert.equal(order.total, 648);
    assert.equal(created[0].subtotal, 498, 'the persisted subtotal is server-computed');
});

test('createGuestOrder rejects a product that no longer exists', async () => {
    const { service } = build({ orderRepository: { findProductsByIds: async () => [] } });

    await assert.rejects(
        () => service.createGuestOrder(GUEST_PAYLOAD),
        error => error.statusCode === 400 && error.code === 'PRODUCT_MISSING'
    );
});

test('createGuestOrder rejects insufficient stock and never persists', async () => {
    const { service, createCalls } = build({
        orderRepository: {
            findProductsByIds: async () => [{ id: 3, name: 'Mogra Attar', price: 500, size_pricing: { '3ml': 249 }, in_stock: true, stock_quantity: 1 }],
        },
    });

    await assert.rejects(
        () => service.createGuestOrder({ ...GUEST_PAYLOAD, items: [{ productId: 3, size: '3ml', quantity: 5 }] }),
        error => error.statusCode === 409 && error.code === 'INSUFFICIENT_STOCK' && /only 1 unit/.test(error.message)
    );

    assert.equal(createCalls.length, 0, 'no order is written when stock is insufficient');
});

test('createGuestOrder accepts a quantity equal to the available stock (low stock)', async () => {
    const { service } = build({
        orderRepository: {
            findProductsByIds: async () => [{ id: 3, name: 'Mogra Attar', price: 500, size_pricing: { '3ml': 249 }, in_stock: true, stock_quantity: 2 }],
        },
    });

    const order = await service.createGuestOrder(GUEST_PAYLOAD);
    assert.equal(order.items[0].quantity, 2);
});

test('createGuestOrder and createOrder share the same persistence path', async () => {
    // Sanity check: the signed-in flow still behaves exactly as before after the
    // refactor (userId flows through, address resolution still applies).
    const { service, createCalls } = build();
    const order = await service.createOrder(7, {
        addressId: 11,
        items: [{ productId: 3, size: '3ml', quantity: 1 }],
        source: 'web',
    });

    assert.equal(createCalls[0].userId, 7);
    assert.equal(order.subtotal, 249);
    assert.equal(order.total, 399);
});

