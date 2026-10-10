import test from 'node:test';
import assert from 'node:assert/strict';

// guestCheckoutValidator.js is a plain ES module with no browser deps, so it is
// exercised directly from Node (mirroring stock.util.test.js). These pin the
// client-side rules that mirror the backend validateGuestOrder().
import {
    validateGuestCheckout,
    normalizePhone,
} from '../../../../src/features/checkout/validators/guestCheckoutValidator.js';

const VALID = {
    fullName: 'Aisha Khan',
    phone: '9876543210',
    addressLine: '12 Carter Road',
    addressLine2: 'Apt 4',
    city: 'Mumbai',
    state: 'MH',
    postalCode: '400050',
    email: 'aisha@example.com',
};

test('validateGuestCheckout accepts a complete form and normalises the phone', () => {
    const { valid, errors, values } = validateGuestCheckout(VALID);

    assert.equal(valid, true);
    assert.deepEqual(errors, {});
    assert.equal(values.phone, '9876543210');
    assert.equal(values.postalCode, '400050');
});

test('validateGuestCheckout requires name, phone, address, city and PIN', () => {
    const { valid, errors } = validateGuestCheckout({});

    assert.equal(valid, false);
    assert.ok(errors.fullName);
    assert.ok(errors.phone);
    assert.ok(errors.addressLine);
    assert.ok(errors.city);
    assert.ok(errors.postalCode);
});

test('validateGuestCheckout reports a missing vs invalid phone distinctly', () => {
    assert.match(validateGuestCheckout({ ...VALID, phone: '' }).errors.phone, /enter your mobile/i);
    assert.match(validateGuestCheckout({ ...VALID, phone: '123' }).errors.phone, /10-digit/i);
    assert.match(validateGuestCheckout({ ...VALID, phone: '1234567890' }).errors.phone, /10-digit/i);
});

test('validateGuestCheckout rejects a bad PIN but accepts a 6-digit one', () => {
    assert.match(validateGuestCheckout({ ...VALID, postalCode: '40' }).errors.postalCode, /6-digit/i);
    assert.match(validateGuestCheckout({ ...VALID, postalCode: 'abcdeg' }).errors.postalCode, /6-digit/i);
    assert.equal(validateGuestCheckout({ ...VALID, postalCode: '400 050' }).valid, true, 'spaces are stripped');
});

test('validateGuestCheckout keeps email optional but validates it when present', () => {
    assert.equal(validateGuestCheckout({ ...VALID, email: '' }).valid, true);
    assert.equal(validateGuestCheckout({ ...VALID, email: undefined }).valid, true);
    assert.match(validateGuestCheckout({ ...VALID, email: 'nope' }).errors.email, /valid email/i);
});

test('validateGuestCheckout treats a phone with the +91 country code as valid', () => {
    const { valid, values } = validateGuestCheckout({ ...VALID, phone: '+91 98765 43210' });

    assert.equal(valid, true);
    assert.equal(values.phone, '9876543210');
});

test('normalizePhone returns null for anything that is not a 10-digit Indian mobile', () => {
    assert.equal(normalizePhone('+91 98765 43210'), '9876543210');
    assert.equal(normalizePhone('9876543210'), '9876543210');
    assert.equal(normalizePhone('12345'), null);
    assert.equal(normalizePhone('5876543210'), null, 'must start 6-9');
    assert.equal(normalizePhone(''), null);
});
