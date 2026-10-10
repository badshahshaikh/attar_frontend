import ValidationError from '../../core/errors/ValidationError.js';

/**
 * Parse and validate order list query parameters
 * Mirrors the products/customers parseListQuery page/limit rules.
 *
 * @param {Object} query - Query parameters from request
 * @returns {Object} Normalized query parameters
 */
export function parseOrderListQuery(query) {
    const page = Math.max(
        1,
        Number.parseInt(query.page, 10) || 1
    );

    const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(query.limit, 10) || 50)
    );

    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const status = typeof query.status === 'string' ? query.status.trim() : '';
    const paymentStatus = typeof query.paymentStatus === 'string' ? query.paymentStatus.trim() : '';

    return { page, limit, search, status, paymentStatus };
}

/**
 * Parse an order id route parameter
 * @param {*} rawId - Raw route parameter
 * @returns {number|null} Positive integer id, or null when invalid
 */
export function parseOrderIdParam(rawId) {
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
}

// Allowed general order statuses. Mirrors the frontend ORDER_STATUS_OPTIONS.
export const ORDER_STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];

// Allowed payment statuses. The backend only ever writes 'unpaid' (default) or
// 'paid' (Razorpay capture), so those are the values a manual update may set.
export const PAYMENT_STATUSES = ['unpaid', 'paid'];

// The only fields an admin status update may touch, mapped to the payload keys.
const STATUS_FIELDS = ['status', 'paymentStatus'];

/**
 * Validate an order status update body.
 *
 * Updates exactly one field at a time (`{ status }` or `{ paymentStatus }`).
 * The general order status and payment status are independent — this never
 * touches one when the other is supplied. Rejects an empty body, unknown
 * fields, and any value outside the allowed set.
 *
 * @param {Object} body - Request body
 * @returns {{ status?: string, paymentStatus?: string }} The validated field(s)
 * @throws {ValidationError} On any invalid/empty/unsupported input
 */
export function parseOrderStatusUpdate(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ValidationError('Request body must be an object');
    }

    const provided = STATUS_FIELDS.filter((field) => body[field] !== undefined);

    if (provided.length === 0) {
        throw new ValidationError("Provide a 'status' or 'paymentStatus' field to update");
    }

    if (provided.length > 1) {
        throw new ValidationError('Update one field at a time: send either status or paymentStatus');
    }

    const field = provided[0];
    const value = body[field];

    if (typeof value !== 'string' || value.trim() === '') {
        throw new ValidationError(`${field} must be a non-empty string`);
    }

    const normalized = value.trim().toLowerCase();
    const allowed = field === 'status' ? ORDER_STATUSES : PAYMENT_STATUSES;

    if (!allowed.includes(normalized)) {
        throw new ValidationError(`Invalid ${field} "${value}". Allowed values: ${allowed.join(', ')}`);
    }

    return { [field]: normalized };
}