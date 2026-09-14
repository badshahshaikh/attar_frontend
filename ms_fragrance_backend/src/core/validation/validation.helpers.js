import ValidationError from '../errors/ValidationError.js';


export function requireText(value, fieldName, message) {
    if (!value || !String(value).trim()) {
        throw new ValidationError(
            message || `${fieldName} is required`
        );
    }

    return String(value).trim();
}

export function validateArrayFields(payload, fields) {
    for (const field of fields) {
        if (
            payload[field] !== undefined &&
            !Array.isArray(payload[field])
        ) {
            throw new ValidationError(
                `${field} must be an array`
            );
        }
    }
}

export function validateObjectField(payload, field, message) {
    const value = payload[field];

    if (
        value !== undefined &&
        (
            typeof value !== 'object' ||
            Array.isArray(value) ||
            value === null
        )
    ) {
        throw new ValidationError(
            message || `${field} must be an object`
        );
    }
}


export function validateNonNegativeNumber(
    value,
    fieldName,
    options = {}
) {
    const {
        required = false
    } = options;

    if (
        value === undefined ||
        value === null ||
        value === ''
    ) {
        if (required) {
            throw new ValidationError(
                `${fieldName} must be a non-negative number`
            );
        }

        return;
    }

    const number = Number(value);

    if (
        !Number.isFinite(number) ||
        number < 0
    ) {
        throw new ValidationError(
            `${fieldName} must be a non-negative number`
        );
    }

    return number;
}

export function validateNonNegativeInteger(
    value,
    fieldName,
    options = {}
) {
    const {
        required = false
    } = options;

    if (
        value === undefined ||
        value === null ||
        value === ''
    ) {
        if (required) {
            throw new ValidationError(
                `${fieldName} must be a non-negative integer`
            );
        }

        return;
    }

    const number = Number(value);

    if (
        !Number.isInteger(number) ||
        number < 0
    ) {
        throw new ValidationError(
            `${fieldName} must be a non-negative integer`
        );
    }

    return number;
}

export function validateRange(
    value,
    fieldName,
    min,
    max
) {
    if (
        value === undefined ||
        value === null ||
        value === ''
    ) {
        return;
    }

    const number = Number(value);

    if (
        !Number.isFinite(number) ||
        number < min ||
        number > max
    ) {
        throw new ValidationError(
            `${fieldName} must be between ${min} and ${max}`
        );
    }

    return number;
}

export function parseBoolean(value, fieldName) {
    if (value === undefined) return undefined;
    if (value === true || value === false) return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    throw new Error(`${fieldName} must be a boolean`);
}