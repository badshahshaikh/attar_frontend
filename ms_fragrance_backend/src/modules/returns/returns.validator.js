import ValidationError from '../../core/errors/ValidationError.js';
import { RETURN_STATUSES, RETURN_TRANSITIONS, REFUND_METHODS } from './returns.constants.js';

const MAX_TEXT_LENGTH = 2000;

/**
 * returns.validator.js — Parse + validate every returns endpoint payload.
 * Mirrors the orders/orders.validator.js conventions (parseX helpers, 400
 * ValidationError semantics, lowercase normalization).
 */

/**
 * Parse a return id route parameter.
 * @param {*} rawId - Raw route parameter
 * @returns {number|null} Positive integer id, or null when invalid
 */
export function parseReturnIdParam(rawId) {
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
}

/**
 * Parse the returns list query parameters.
 * @param {Object} query - Query parameters from request
 * @returns {Object} Normalized { page, limit, search, status }
 */
export function parseReturnListQuery(query) {
    const page = Math.max(1, Number.parseInt(query?.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(query?.limit, 10) || 20));
    const search = typeof query?.search === 'string' ? query.search.trim() : '';
    const rawStatus = typeof query?.status === 'string' ? query.status.trim().toLowerCase() : '';

    if (rawStatus && !RETURN_STATUSES.includes(rawStatus)) {
        throw new ValidationError(`Invalid status "${query.status}". Allowed values: ${RETURN_STATUSES.join(', ')}`);
    }

    return { page, limit, search, status: rawStatus };
}

/**
 * Parse the eligibility lookup query.
 * @param {Object} query - Query parameters from request
 * @returns {{ orderId: number }} The validated order id
 * @throws {ValidationError} When orderId is missing/invalid
 */
export function parseEligibilityQuery(query) {
    const orderId = Number(query?.orderId);

    if (!Number.isInteger(orderId) || orderId <= 0) {
        throw new ValidationError('Provide a valid orderId query parameter');
    }

    return { orderId };
}

function requirePositiveInteger(value, label) {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new ValidationError(`${label} must be a positive integer`);
    }

    return parsed;
}

function requireText(value, label, { optional = false, maxLength = MAX_TEXT_LENGTH } = {}) {
    if (value === undefined || value === null) {
        if (optional) return '';
        throw new ValidationError(`${label} is required`);
    }

    const text = String(value).trim();

    if (!text) {
        if (optional) return '';
        throw new ValidationError(`${label} is required`);
    }

    if (text.length > maxLength) {
        throw new ValidationError(`${label} must be ${maxLength} characters or fewer`);
    }

    return text;
}

/**
 * Validate a create-return body.
 * @param {Object} body - Request body
 * @returns {{ orderId, items, customerReason, internalNotes, unopenedConfirmed }}
 * @throws {ValidationError} On any invalid input
 */
export function parseCreateReturn(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ValidationError('Request body must be an object');
    }

    const orderId = requirePositiveInteger(body.orderId, 'orderId');

    if (!Array.isArray(body.items) || body.items.length === 0) {
        throw new ValidationError('Select at least one order item to return');
    }

    const seen = new Set();
    const items = body.items.map((entry, index) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            throw new ValidationError(`items[${index}] must be an object with orderItemId and quantity`);
        }

        const orderItemId = requirePositiveInteger(entry.orderItemId, `items[${index}].orderItemId`);
        const quantity = requirePositiveInteger(entry.quantity, `items[${index}].quantity`);

        if (seen.has(orderItemId)) {
            throw new ValidationError(`Order item ${orderItemId} is listed more than once`);
        }
        seen.add(orderItemId);

        return { orderItemId, quantity };
    });

    const customerReason = requireText(body.customerReason, 'customerReason', { maxLength: 1000 });
    const internalNotes = requireText(body.internalNotes, 'internalNotes', { optional: true });

    if (body.unopenedConfirmed !== true) {
        throw new ValidationError('Confirm that the returned products are unopened before creating the return');
    }

    return { orderId, items, customerReason, internalNotes, unopenedConfirmed: true };
}

/**
 * Validate a return status update body.
 * @param {Object} body - Request body
 * @returns {{ status: string, note: string }} Normalized status + optional note
 * @throws {ValidationError} On any invalid input
 */
export function parseReturnStatusUpdate(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ValidationError('Request body must be an object');
    }

    const rawStatus = body.status;

    if (typeof rawStatus !== 'string' || rawStatus.trim() === '') {
        throw new ValidationError('status must be a non-empty string');
    }

    const status = rawStatus.trim().toLowerCase();

    if (!RETURN_STATUSES.includes(status)) {
        throw new ValidationError(`Invalid status "${body.status}". Allowed values: ${RETURN_STATUSES.join(', ')}`);
    }

    const note = requireText(body.note, 'note', { optional: true });

    return { status, note, inspected: parseInspected(body.inspected) };
}

/**
 * Parse the inspection-confirmation flag. The server never trusts a
 * frontend-only value: only an explicit boolean (or its string form) is
 * accepted, and only `true` confirms an inspection.
 * @param {*} value - Raw `inspected` field from the request body
 * @returns {boolean} True only when the admin explicitly confirmed
 * @throws {ValidationError} When the value is present but not boolean-like
 */
function parseInspected(value) {
    if (value === undefined || value === null || value === '') return false;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    throw new ValidationError('inspected must be a boolean');
}

/**
 * Validate a record-refund body.
 * @param {Object} body - Request body
 * @returns {{ amount, method, reference, refundedAt }} Normalized refund fields
 * @throws {ValidationError} On any invalid input
 */
export function parseRecordRefund(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ValidationError('Request body must be an object');
    }

    // Only numbers and numeric strings may become a money amount: booleans,
    // arrays and objects must never coerce (Number(true) === 1).
    if (typeof body.amount !== 'number' && typeof body.amount !== 'string') {
        throw new ValidationError('amount must be a positive number');
    }

    const amount = Number(body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ValidationError('amount must be a positive number');
    }

    const rounded = Math.round(amount * 100) / 100;

    if (rounded <= 0) {
        throw new ValidationError('amount must be a positive number');
    }

    const rawMethod = body.method === undefined || body.method === null || body.method === ''
        ? 'manual'
        : String(body.method).trim().toLowerCase();

    if (!REFUND_METHODS.includes(rawMethod)) {
        throw new ValidationError(`Invalid method "${body.method}". Allowed values: ${REFUND_METHODS.join(', ')}`);
    }

    const reference = requireText(body.reference, 'reference', { optional: true, maxLength: 500 });

    let refundedAt = null;
    if (body.refundedAt !== undefined && body.refundedAt !== null && String(body.refundedAt).trim() !== '') {
        const parsed = new Date(body.refundedAt);
        if (Number.isNaN(parsed.getTime())) {
            throw new ValidationError('refundedAt must be a valid date');
        }
        if (parsed.getTime() > Date.now()) {
            throw new ValidationError('refundedAt cannot be in the future');
        }
        refundedAt = parsed.toISOString();
    }

    return { amount: rounded, method: rawMethod, reference, refundedAt };
}

/**
 * Validate the delivered-date override used when marking an order delivered.
 * @param {*} value - Raw deliveredAt value (optional)
 * @returns {string|null} ISO date string, or null when not supplied
 * @throws {ValidationError} On invalid / future dates
 */
export function parseDeliveredAt(value) {
    if (value === undefined || value === null || String(value).trim() === '') {
        return null;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        throw new ValidationError('deliveredAt must be a valid date');
    }

    if (parsed.getTime() > Date.now()) {
        throw new ValidationError('deliveredAt cannot be in the future');
    }

    return parsed.toISOString();
}

/**
 * Is `next` a legal transition from `current`?
 * @param {string} current - Current return status
 * @param {string} next - Desired return status
 * @returns {boolean} True when the transition is allowed
 */
export function isAllowedReturnTransition(current, next) {
    return (RETURN_TRANSITIONS[current] || []).includes(next);
}

