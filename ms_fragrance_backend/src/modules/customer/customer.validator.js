import ValidationError from '../../core/errors/ValidationError.js';
import { requireText } from '../../core/validation/validation.helpers.js';

const PHONE_PATTERN = /^[6-9]\d{9}$/;
const POSTAL_PATTERN = /^[0-9]{6}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ADDRESS_LENGTH = 200;
const MAX_ITEMS_PER_ORDER = 50;
const MAX_QUANTITY_PER_ITEM = 99;

function requirePhone(value) {
    const digits = String(requireText(value, 'Phone number')).replace(/\D/g, '');
    const national = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;

    if (!PHONE_PATTERN.test(national)) {
        throw new ValidationError('Enter a valid 10-digit phone number');
    }

    return national;
}

function requirePostalCode(value) {
    const code = String(requireText(value, 'PIN code')).replace(/\s/g, '');

    if (!POSTAL_PATTERN.test(code)) {
        throw new ValidationError('Enter a valid 6-digit PIN code');
    }

    return code;
}

function optionalText(value, maxLength) {
    if (value === undefined || value === null || String(value).trim() === '') {
        return null;
    }

    return String(value).trim().slice(0, maxLength);
}

function optionalEmail(value) {
    const email = optionalText(value, 255);

    if (email === null) {
        return null;
    }

    if (!EMAIL_PATTERN.test(email)) {
        throw new ValidationError('Enter a valid email address');
    }

    return email.toLowerCase();
}

function validateAddressPayload(body) {
    return {
        label: optionalText(body.label, 50),
        fullName: requireText(body.fullName, 'Full name').slice(0, MAX_ADDRESS_LENGTH),
        phone: requirePhone(body.phone),
        line1: requireText(body.line1, 'Address line 1').slice(0, MAX_ADDRESS_LENGTH),
        line2: optionalText(body.line2, MAX_ADDRESS_LENGTH),
        city: requireText(body.city, 'City').slice(0, MAX_ADDRESS_LENGTH),
        state: requireText(body.state, 'State').slice(0, MAX_ADDRESS_LENGTH),
        postalCode: requirePostalCode(body.postalCode),
        country: optionalText(body.country, 50) || 'India',
        isDefault: body.isDefault === true,
    };
}

function validateAddressUpdate(body) {
    return {
        label: optionalText(body.label, 50),
        fullName: requireText(body.fullName, 'Full name').slice(0, MAX_ADDRESS_LENGTH),
        phone: requirePhone(body.phone),
        line1: requireText(body.line1, 'Address line 1').slice(0, MAX_ADDRESS_LENGTH),
        line2: optionalText(body.line2, MAX_ADDRESS_LENGTH),
        city: requireText(body.city, 'City').slice(0, MAX_ADDRESS_LENGTH),
        state: requireText(body.state, 'State').slice(0, MAX_ADDRESS_LENGTH),
        postalCode: requirePostalCode(body.postalCode),
        country: optionalText(body.country, 50) || 'India',
        isDefault: body.isDefault === true,
    };
}

function validateOrderItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new ValidationError('Your order has no items');
    }

    if (items.length > MAX_ITEMS_PER_ORDER) {
        throw new ValidationError('An order cannot contain that many items');
    }

    return items.map((item, index) => {
        const label = `Item ${index + 1}`;
        const productId = Number(item.productId);

        if (!Number.isInteger(productId) || productId <= 0) {
            throw new ValidationError(`${label} is not a valid product`);
        }

        const quantity = Number(item.quantity);

        if (!Number.isInteger(quantity) || quantity < 1) {
            throw new ValidationError(`${label} quantity must be at least 1`);
        }

        if (quantity > MAX_QUANTITY_PER_ITEM) {
            throw new ValidationError(`${label} quantity is too large`);
        }

        return {
            productId,
            size: requireText(item.size, `${label} size`),
            quantity,
        };
    });
}

function validateCreateOrder(body) {
    const addressId = body.addressId === undefined || body.addressId === null || body.addressId === ''
        ? null
        : Number(body.addressId);

    if (addressId !== null && (!Number.isInteger(addressId) || addressId <= 0)) {
        throw new ValidationError('Select a valid saved address');
    }

    return {
        addressId,
        contactName: optionalText(body.contactName, MAX_ADDRESS_LENGTH),
        contactPhone: body.contactPhone ? requirePhone(body.contactPhone) : null,
        notes: optionalText(body.notes, 500),
        source: body.source === 'web' ? 'web' : 'whatsapp',
        items: validateOrderItems(body.items),
    };
}

// Guest checkout: a shopper with no account still supplies everything needed to
// ship and reach them. Prices are never accepted here — the service recomputes
// them from the products table — so only identity/delivery fields are validated.
// The result is a camelCase address snapshot (matching what the signed-in flow
// stores in orders.shipping_address) plus the contact fields the orders row
// requires, so a guest order fits the existing schema with no migration.
function validateGuestOrder(body) {
    const fullName = requireText(body.fullName, 'Full name').slice(0, MAX_ADDRESS_LENGTH);
    const phone = requirePhone(body.phone);
    const line1 = requireText(body.addressLine, 'Delivery address').slice(0, MAX_ADDRESS_LENGTH);
    const city = requireText(body.city, 'City').slice(0, MAX_ADDRESS_LENGTH);
    const postalCode = requirePostalCode(body.postalCode);

    return {
        address: {
            fullName,
            phone,
            line1,
            line2: optionalText(body.addressLine2, MAX_ADDRESS_LENGTH),
            city,
            // State is optional for guests (the delivery address is captured as a
            // free-text line); keep it when provided so admin sees the full address.
            state: optionalText(body.state, MAX_ADDRESS_LENGTH) || '',
            postalCode,
            country: optionalText(body.country, 50) || 'India',
            email: optionalEmail(body.email),
        },
        contactName: fullName,
        contactPhone: phone,
        notes: optionalText(body.notes, 500),
        source: body.source === 'web' ? 'web' : 'whatsapp',
        items: validateOrderItems(body.items),
    };
}

export {
  validateAddressPayload,
  validateAddressUpdate,
  validateCreateOrder,
  validateGuestOrder
};