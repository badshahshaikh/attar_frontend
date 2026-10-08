/**
 * Parse and validate customer list query parameters
 * Mirrors the products parseListQuery page/limit rules.
 *
 * @param {Object} query - Query parameters from request
 * @returns {Object} Normalized query parameters
 */
export function parseCustomerListQuery(query) {
    const page = Math.max(
        1,
        Number.parseInt(query.page, 10) || 1
    );

    const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(query.limit, 10) || 50)
    );

    const search = typeof query.search === 'string' ? query.search.trim() : '';

    return { page, limit, search };
}