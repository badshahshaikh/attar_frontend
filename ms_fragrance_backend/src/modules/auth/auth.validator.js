import ValidationError from '../../core/errors/ValidationError.js';
import { requireText } from '../../core/validation/validation.helpers.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^[6-9]\d{9}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_FULL_NAME_LENGTH = 120;

function requireEmail(value) {
    const email = requireText(value, 'Email').toLowerCase();

    if (!EMAIL_PATTERN.test(email)) {
        throw new ValidationError('Enter a valid email address');
    }

    return email;
}

function requirePhone(value) {
    const digits = String(requireText(value, 'Phone number')).replace(/\D/g, '');

    // Accept "+91 98765 43210", "919876543210" and a bare 10-digit number.
    const national = digits.length === 12 && digits.startsWith('91')
        ? digits.slice(2)
        : digits;

    if (!PHONE_PATTERN.test(national)) {
        throw new ValidationError('Enter a valid 10-digit phone number');
    }

    return national;
}

function requirePassword(value) {
    const password = requireText(value, 'Password');

    if (password.length < MIN_PASSWORD_LENGTH) {
        throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
        throw new ValidationError('Password must contain at least one letter and one number');
    }

    return password;
}

function requireFullName(value) {
    const fullName = requireText(value, 'Full name');

    if (fullName.length > MAX_FULL_NAME_LENGTH) {
        throw new ValidationError('Full name is too long');
    }

    return fullName;
}

function validateLogin(body) {
    const { username, password } = body;
    if (!username || !password) throw new Error('Username/email and password are required');
    return { username, password };
}

function validateCustomerRegister(body) {
    const fullName = requireFullName(body.fullName);
    const email = requireEmail(body.email);
    const phone = requirePhone(body.phone);
    const password = requirePassword(body.password);

    if (body.confirmPassword !== undefined && body.confirmPassword !== body.password) {
        throw new ValidationError('Passwords do not match');
    }

    return { fullName, email, phone, password };
}

function validateCustomerLogin(body) {
    return {
        email: requireEmail(body.email),
        password: requireText(body.password, 'Password'),
    };
}

function validateProfileUpdate(body) {
    return {
        fullName: requireFullName(body.fullName),
        phone: requirePhone(body.phone),
    };
}

function validatePasswordChange(body) {
    const currentPassword = requireText(body.currentPassword, 'Current password');
    const newPassword = requirePassword(body.newPassword);

    if (currentPassword === newPassword) {
        throw new ValidationError('New password must be different from your current password');
    }

    return { currentPassword, newPassword };
}

export {
  validateLogin,
  validateCustomerRegister,
  validateCustomerLogin,
  validateProfileUpdate,
  validatePasswordChange
};
