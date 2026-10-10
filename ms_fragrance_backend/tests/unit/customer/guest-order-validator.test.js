import test from 'node:test';
import assert from 'node:assert/strict';

import { validateGuestOrder } from '../../../src/modules/customer/customer.validator.js';

const VALID_GUEST = {
    fullName: 'Aisha Khan',
    phone: '+91 98765 43210',
    addressLine: '12 Carter Road',
    city: 'Mumbai',
    postalCode: '400050',
    email: 'aisha@example.com',
    items: [{ productId: 3, size: '3ml', quantity: 1 }],
};

test('validateGuestOrder normalises contact + address and builds a snapshot', () => {
    const payload = validateGuestOrder(VALID_GUEST);

    assert.equal(payload.contactName, 'Aisha Khan');
    assert.equal(payload.contactPhone, '9876543210');
    assert.equal(payload.address.fullName, 'Aisha Khan');
    assert.equal(payload.address.phone, '9876543210');
    assert.equal(payload.address.line1, '12 Carter Road');
    assert.equal(payload.address.city, 'Mumbai');
    assert.equal(payload.address.postalCode, '400050');
    assert.equal(payload.address.country, 'India');
    assert.equal(payload.address.email, 'aisha@example.com');
    assert.equal(payload.source, 'whatsapp');
    assert.equal(payload.items.length, 1);
});

test('validateGuestOrder never trusts prices/totals from the client (ignores any sent)', () => {
    const payload = validateGuestOrder({
        ...VALID_GUEST,
        subtotal: 1,
        shipping: 0,
        total: 1,
        unitPrice: 1,
        items: [{ productId: 3, size: '3ml', quantity: 1, unitPrice: 999999, lineTotal: 999999 }],
    });

    // The validated item carries only productId/size/quantity — no price fields.
    assert.deepEqual(payload.items[0], { productId: 3, size: '3ml', quantity: 1 });
    assert.equal(payload.subtotal, undefined, 'no subtotal is derived from the request');
    assert.equal(payload.total, undefined, 'no total is derived from the request');
});

test('validateGuestOrder requires a full name', () => {
    assert.throws(() => validateGuestOrder({ ...VALID_GUEST, fullName: '   ' }), /full name/i);
    assert.throws(() => validateGuestOrder({ ...VALID_GUEST, fullName: undefined }), /full name/i);
});

test('validateGuestOrder requires a valid mobile number', () => {
    assert.throws(() => validateGuestOrder({ ...VALID_GUEST, phone: '123' }), /10-digit/i);
    assert.throws(() => validateGuestOrder({ ...VALID_GUEST, phone: '' }), /phone/i);
    // A 12-digit number with the 91 country code is accepted and normalised.
    assert.equal(validateGuestOrder({ ...VALID_GUEST, phone: '919876543210' }).contactPhone, '9876543210');
});

test('validateGuestOrder requires a delivery address, city and PIN code', () => {
    assert.throws(() => validateGuestOrder({ ...VALID_GUEST, addressLine: '' }), /address/i);
    assert.throws(() => validateGuestOrder({ ...VALID_GUEST, city: '' }), /city/i);
    assert.throws(() => validateGuestOrder({ ...VALID_GUEST, postalCode: 'abc' }), /6-digit PIN/i);
    assert.throws(() => validateGuestOrder({ ...VALID_GUEST, postalCode: undefined }), /PIN code/i);
});

test('validateGuestOrder keeps email optional but validates it when present', () => {
    assert.equal(validateGuestOrder({ ...VALID_GUEST, email: '' }).address.email, null);
    assert.equal(validateGuestOrder({ ...VALID_GUEST, email: undefined }).address.email, null);
    assert.equal(validateGuestOrder({ ...VALID_GUEST, email: 'Aisha@Example.COM' }).address.email, 'aisha@example.com');
    assert.throws(() => validateGuestOrder({ ...VALID_GUEST, email: 'not-an-email' }), /valid email/i);
});

test('validateGuestOrder keeps optional state/line2 and rejects an empty basket', () => {
    const payload = validateGuestOrder({ ...VALID_GUEST, state: 'MH', addressLine2: 'Apt 4' });
    assert.equal(payload.address.state, 'MH');
    assert.equal(payload.address.line2, 'Apt 4');
    assert.equal(validateGuestOrder({ ...VALID_GUEST, state: undefined }).address.state, '');

    assert.throws(() => validateGuestOrder({ ...VALID_GUEST, items: [] }), /no items/i);
    assert.throws(() => validateGuestOrder({ ...VALID_GUEST, items: undefined }), /no items/i);
    assert.throws(
        () => validateGuestOrder({ ...VALID_GUEST, items: [{ productId: 0, size: '3ml', quantity: 1 }] }),
        /not a valid product/i
    );
});

test('validateGuestOrder maps source web but defaults anything else to whatsapp', () => {
    assert.equal(validateGuestOrder({ ...VALID_GUEST, source: 'web' }).source, 'web');
    assert.equal(validateGuestOrder({ ...VALID_GUEST, source: 'evil' }).source, 'whatsapp');
    assert.equal(validateGuestOrder({ ...VALID_GUEST }).source, 'whatsapp');
});
