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