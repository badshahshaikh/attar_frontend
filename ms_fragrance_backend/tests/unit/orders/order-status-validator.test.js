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

test('parseOrderIdParam still validates the id route param', () => {
    assert.equal(parseOrderIdParam('7'), 7);
    assert.equal(parseOrderIdParam('0'), null);
    assert.equal(parseOrderIdParam('-1'), null);
    assert.equal(parseOrderIdParam('abc'), null);
    assert.equal(parseOrderIdParam(undefined), null);
});
