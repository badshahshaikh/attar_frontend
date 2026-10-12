import test from 'node:test';
import assert from 'node:assert/strict';

import {
    parseOrderStatusUpdate,
    parseOrderIdParam,
    ORDER_STATUSES,
    PAYMENT_STATUSES,
} from '../../../src/modules/orders/orders.validator.js';

test('parseOrderStatusUpdate accepts a general order status update', () => {
    assert.deepEqual(parseOrderStatusUpdate({ status: 'shipped' }), { status: 'shipped' });
    assert.deepEqual(parseOrderStatusUpdate({ status: 'DELIVERED' }), { status: 'delivered' }, 'value is lowercased');
});

test('parseOrderStatusUpdate accepts a payment status update', () => {
    assert.deepEqual(parseOrderStatusUpdate({ paymentStatus: 'paid' }), { paymentStatus: 'paid' });
    assert.deepEqual(parseOrderStatusUpdate({ paymentStatus: 'UNPAID' }), { paymentStatus: 'unpaid' });
});

test('parseOrderStatusUpdate supports every allowed order status', () => {
    for (const status of ORDER_STATUSES) {
        assert.deepEqual(parseOrderStatusUpdate({ status }), { status });
    }
});

test('parseOrderStatusUpdate rejects an empty body', () => {
    assert.throws(() => parseOrderStatusUpdate({}), /status.*paymentStatus/i);
    assert.throws(() => parseOrderStatusUpdate(undefined), /object/i);
    assert.throws(() => parseOrderStatusUpdate(null), /object/i);
    assert.throws(() => parseOrderStatusUpdate([]), /object/i);
});

test('parseOrderStatusUpdate rejects unsupported fields', () => {
    assert.throws(() => parseOrderStatusUpdate({ total: 5 }), /status.*paymentStatus/i);
    assert.throws(() => parseOrderStatusUpdate({ subtotal: 5, shipping: 0 }), /status.*paymentStatus/i);
});

test('parseOrderStatusUpdate rejects sending both fields at once', () => {
    assert.throws(() => parseOrderStatusUpdate({ status: 'shipped', paymentStatus: 'paid' }), /one field at a time/i);
});

test('parseOrderStatusUpdate rejects an invalid status value with 400 semantics', () => {
    assert.throws(() => parseOrderStatusUpdate({ status: 'teleported' }), error =>
        error.statusCode === 400 && /Invalid status/.test(error.message) && /placed, confirmed/.test(error.message)
    );
    assert.throws(() => parseOrderStatusUpdate({ paymentStatus: 'refunded' }), error =>
        error.statusCode === 400 && /Invalid paymentStatus/.test(error.message)
    );
});

test('parseOrderStatusUpdate rejects non-string / blank values', () => {
    assert.throws(() => parseOrderStatusUpdate({ status: '' }), /non-empty string/i);
    assert.throws(() => parseOrderStatusUpdate({ status: '   ' }), /non-empty string/i);
    assert.throws(() => parseOrderStatusUpdate({ status: 5 }), /non-empty string/i);
    // null is a provided value (not undefined), so it is rejected as invalid
    // rather than treated as "no field supplied".
    assert.throws(() => parseOrderStatusUpdate({ paymentStatus: null }), /non-empty string/i);
});

test('supported payment statuses are exactly unpaid and paid', () => {
    assert.deepEqual(PAYMENT_STATUSES, ['unpaid', 'paid']);
});

// ── deliveredAt: only ever alongside a delivered status ─────────────────────
test('parseOrderStatusUpdate accepts a valid deliveredAt with a delivered status', () => {
    assert.deepEqual(
        parseOrderStatusUpdate({ status: 'delivered', deliveredAt: '2026-10-01T10:00:00.000Z' }),
        { status: 'delivered', deliveredAt: '2026-10-01T10:00:00.000Z' }
    );
});

test('parseOrderStatusUpdate omits deliveredAt when not supplied so the repository stamps it', () => {
    const update = parseOrderStatusUpdate({ status: 'delivered' });
    assert.deepEqual(update, { status: 'delivered' });
    assert.ok(!('deliveredAt' in update), 'no deliveredAt key is returned when the caller omits it');
});

test('parseOrderStatusUpdate rejects an invalid deliveredAt date', () => {
    assert.throws(
        () => parseOrderStatusUpdate({ status: 'delivered', deliveredAt: 'not-a-date' }),
        error => error.statusCode === 400 && /valid date/i.test(error.message)
    );
});

test('parseOrderStatusUpdate rejects a future deliveredAt date', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    assert.throws(
        () => parseOrderStatusUpdate({ status: 'delivered', deliveredAt: future }),
        error => error.statusCode === 400 && /future/i.test(error.message)
    );
});

test('parseOrderStatusUpdate rejects deliveredAt on a payment-only update', () => {
    assert.throws(
        () => parseOrderStatusUpdate({ paymentStatus: 'paid', deliveredAt: '2026-10-01T10:00:00.000Z' }),
        error => error.statusCode === 400 && /only be supplied with status "delivered"/i.test(error.message)
    );
});

test('parseOrderStatusUpdate rejects deliveredAt on a non-delivered order status', () => {
    assert.throws(
        () => parseOrderStatusUpdate({ status: 'shipped', deliveredAt: '2026-10-01T10:00:00.000Z' }),
        error => error.statusCode === 400 && /only be supplied with status "delivered"/i.test(error.message)
    );
});

test('parseOrderIdParam still validates the id route param', () => {
    assert.equal(parseOrderIdParam('7'), 7);
    assert.equal(parseOrderIdParam('0'), null);
    assert.equal(parseOrderIdParam('-1'), null);
    assert.equal(parseOrderIdParam('abc'), null);
    assert.equal(parseOrderIdParam(undefined), null);
});
