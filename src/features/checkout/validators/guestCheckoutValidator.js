/**
 * guestCheckoutValidator.js — Frontend validation for the guest checkout form.
 *
 * A plain, browser-free module so it can be unit-tested from Node (mirroring
 * cartReducer.js / utils/stock.js). It mirrors the backend
 * validateGuestOrder() rules so the customer gets fast, inline feedback before
 * a request is sent. The backend remains the authoritative guard — this only
 * avoids obvious round-trips.
 */

const PHONE_PATTERN = /^[6-9]\d{9}$/;
const POSTAL_PATTERN = /^[0-9]{6}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trim(value) {
    return value == null ? '' : String(value).trim();
}

/** Normalises a phone number to 10 national digits, or null when invalid. */
function normalizePhone(value) {
    const digits = trim(value).replace(/\D/g, '');
    const national = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
    return PHONE_PATTERN.test(national) ? national : null;
}

/**
 * Validates the guest checkout form values.
 *
 * @param {object} values - { fullName, phone, addressLine, addressLine2, city, state, postalCode, email }
 * @returns {{ valid: boolean, errors: Record<string,string>, values: object }}
 *   `errors` is keyed by field; `values` holds the trimmed/normalised inputs so
 *   the caller can send a clean payload without re-deriving them.
 */
function validateGuestCheckout(values = {}) {
    const errors = {};

    const fullName = trim(values.fullName);
    const phone = trim(values.phone);
    const addressLine = trim(values.addressLine);
    const addressLine2 = trim(values.addressLine2);
    const city = trim(values.city);
    const state = trim(values.state);
    const postalCode = trim(values.postalCode);
    const email = trim(values.email);

    if (!fullName) {
        errors.fullName = 'Please enter your full name.';
    }

    const normalizedPhone = normalizePhone(phone);
    if (!phone) {
        errors.phone = 'Please enter your mobile number.';
    } else if (!normalizedPhone) {
        errors.phone = 'Enter a valid 10-digit mobile number.';
    }

    if (!addressLine) {
        errors.addressLine = 'Please enter your complete delivery address.';
    }

    if (!city) {
        errors.city = 'Please enter your city.';
    }

    if (!postalCode) {
        errors.postalCode = 'Please enter your PIN / postal code.';
    } else if (!POSTAL_PATTERN.test(postalCode.replace(/\s/g, ''))) {
        errors.postalCode = 'Enter a valid 6-digit PIN code.';
    }

    // Email is optional, but must be a real address when provided.
    if (email && !EMAIL_PATTERN.test(email)) {
        errors.email = 'Enter a valid email address.';
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors,
        values: {
            fullName,
            phone: normalizedPhone,
            addressLine,
            addressLine2: addressLine2 || null,
            city,
            state,
            postalCode: postalCode.replace(/\s/g, ''),
            email: email || null,
        },
    };
}

export { validateGuestCheckout, normalizePhone };
