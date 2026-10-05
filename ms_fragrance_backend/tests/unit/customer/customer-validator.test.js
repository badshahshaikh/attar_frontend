import test from 'node:test';
import assert from 'node:assert/strict';

import {
    validateAddressPayload,
    validateAddressUpdate,
    validateCreateOrder,
} from '../../../src/modules/customer/customer.validator.js';

const VALID_ADDRESS = {
    fullName: 'Aisha Khan',
    phone: '+91 98765 43210',
    line1: '12 Carter Road',
    city: 'Mumbai',
    state: 'MH',
    postalCode: '400050',
};

test('validateAddressPayload normalises and defaults the country', () => {
    const payload = validateAddressPayload({ ...VALID_ADDRESS, isDefault: true });

    assert.equal(payload.phone, '9876543210');
    assert.equal(payload.country, 'India');
    assert.equal(payload.isDefault, true);
    assert.equal(payload.label, null);
});

test('validateAddressPayload rejects an invalid phone or PIN code', () => {
    assert.throws(() => validateAddressPayload({ ...VALID_ADDRESS, phone: '123' }), /10-digit/i);
    assert.throws(() => validateAddressPayload({ ...VALID_ADDRESS, postalCode: 'abcde' }), /6-digit PIN/i);
    assert.throws(() => validateAddressPayload({ ...VALID_ADDRESS, line1: '  ' }), /Address line 1/i);
});

test('validateAddressUpdate keeps isDefault false when it is not sent', () => {
    assert.equal(validateAddressUpdate(VALID_ADDRESS).isDefault, false);
});

test('validateCreateOrder rejects an empty or invalid basket', () => {
    assert.throws(() => validateCreateOrder({ items: [] }), /no items/i);
    assert.throws(() => validateCreateOrder({ items: 'nope' }), /no items/i);
    assert.throws(
        () => validateCreateOrder({ items: [{ productId: 3, size: '3ml', quantity: 0 }] }),
        /at least 1/i
    );
    assert.throws(
        () => validateCreateOrder({ items: [{ productId: 0, size: '3ml', quantity: 1 }] }),
        /not a valid product/i
    );
});

test('validateCreateOrder defaults the source to whatsapp', () => {
    const items = [{ productId: 3, size: '3ml', quantity: 1 }];

    assert.equal(validateCreateOrder({ items }).source, 'whatsapp');
    assert.equal(validateCreateOrder({ items, source: 'web' }).source, 'web');
    assert.equal(validateCreateOrder({ items, source: 'evil' }).source, 'whatsapp');
    assert.equal(validateCreateOrder({ items }).addressId, null);
    assert.throws(() => validateCreateOrder({ items, addressId: 'abc' }), /valid saved address/i);
});