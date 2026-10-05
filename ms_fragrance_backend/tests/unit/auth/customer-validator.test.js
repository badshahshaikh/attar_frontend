import test from 'node:test';
import assert from 'node:assert/strict';

import {
    validateCustomerRegister,
    validateCustomerLogin,
    validateProfileUpdate,
    validatePasswordChange,
} from '../../../src/modules/auth/auth.validator.js';

const VALID_REGISTRATION = {
    fullName: 'Aisha Khan',
    email: 'Aisha@Example.com',
    phone: '+91 98765 43210',
    password: 'attar1234',
};

test('validateCustomerRegister normalizes email and phone', () => {
    const result = validateCustomerRegister(VALID_REGISTRATION);
    assert.equal(result.email, 'aisha@example.com');
    assert.equal(result.phone, '9876543210');
    assert.equal(result.fullName, 'Aisha Khan');
});

test('validateCustomerRegister rejects a malformed email', () => {
    assert.throws(
        () => validateCustomerRegister({ ...VALID_REGISTRATION, email: 'not-an-email' }),
        /valid email/i
    );
});

test('validateCustomerRegister rejects a short or letterless password', () => {
    assert.throws(
        () => validateCustomerRegister({ ...VALID_REGISTRATION, password: 'short1' }),
        /at least 8/i
    );
    assert.throws(
        () => validateCustomerRegister({ ...VALID_REGISTRATION, password: 'onlyletters' }),
        /one letter and one number/i
    );
});

test('validateCustomerRegister rejects mismatched confirmation', () => {
    assert.throws(
        () => validateCustomerRegister({ ...VALID_REGISTRATION, confirmPassword: 'different1' }),
        /do not match/i
    );
});

test('validateCustomerRegister rejects a phone that is not 10 digits', () => {
    assert.throws(
        () => validateCustomerRegister({ ...VALID_REGISTRATION, phone: '12345' }),
        /10-digit/i
    );
});

test('validateCustomerRegister rejects a missing full name', () => {
    assert.throws(
        () => validateCustomerRegister({ ...VALID_REGISTRATION, fullName: '  ' }),
        /Full name/i
    );
});

test('validateCustomerLogin lowercases the email', () => {
    assert.equal(
        validateCustomerLogin({ email: 'USER@example.com', password: 'x' }).email,
        'user@example.com'
    );
});

test('validateProfileUpdate requires both fields', () => {
    assert.throws(() => validateProfileUpdate({ fullName: '', phone: '9876543210' }), /Full name/i);
    assert.throws(() => validateProfileUpdate({ fullName: 'Aisha', phone: 'abc' }), /10-digit/i);
});

test('validatePasswordChange refuses to reuse the current password', () => {
    assert.throws(
        () => validatePasswordChange({ currentPassword: 'attar1234', newPassword: 'attar1234' }),
        /different/i
    );
});