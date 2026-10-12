import { API_URL } from '../config/api';

async function parseResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error || data.message || 'The request could not be completed.');
        error.status = response.status;
        throw error;
    }
    return data;
}

/**
 * Fetch returns for the admin panel (paginated, searchable, filterable).
 * Mirrors fetchOrders: GET /api/returns with page/limit/search/status.
 *
 * Response: { returns: [...], pagination: { page, limit, totalReturns,
 * totalPages, hasNextPage, hasPreviousPage } }
 */
export async function fetchReturns({ page = 1, limit = 10, search = '', status = '' } = {}) {
    const params = new URLSearchParams();

    params.set('page', page);
    params.set('limit', limit);

    if (search) params.set('search', search);
    if (status) params.set('status', status);

    const response = await fetch(`${API_URL}/api/returns?${params.toString()}`, {
        credentials: 'include',
    });

    return parseResponse(response);
}

/**
 * Fetch one return with items, status history, refund and order snapshot.
 * Response: { return: <detail> } — null-safe 404 handled by parseResponse.
 */
export async function fetchReturnDetails(id) {
    const response = await fetch(`${API_URL}/api/returns/${id}`, {
        credentials: 'include',
    });

    return parseResponse(response);
}

/**
 * Pre-check shown before creating a return: is the order delivered, inside
 * the 7-day window, and which quantities per item are still returnable.
 * Response: { order, eligible, reason, deliveredAt, daysAfterDelivery,
 *             daysRemaining, items: [..., { alreadyReturned, returnable }] }
 */
export async function checkReturnEligibility(orderId) {
    const response = await fetch(
        `${API_URL}/api/returns/eligibility?orderId=${encodeURIComponent(orderId)}`,
        { credentials: 'include' }
    );

    return parseResponse(response);
}

/**
 * Create an admin-initiated return.
 *
 * `payload` is exactly the backend contract:
 *   { orderId, items: [{ orderItemId, quantity }], customerReason,
 *     internalNotes, unopenedConfirmed: true }
 *
 * Returns the parsed { return: <detail> } (HTTP 201).
 */
export async function createReturn(payload) {
    const response = await fetch(`${API_URL}/api/returns`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    return parseResponse(response);
}

/**
 * Move a return through the workflow. `payload` is `{ status, note? }`;
 * the server enforces the transition allowlist, requires a note when
 * rejecting, and rejects `refunded` (that state is refund-endpoint only).
 *
 * Returns { return: <detail> } with any `stockRestored` lines.
 */
export async function updateReturnStatus(id, payload) {
    const response = await fetch(`${API_URL}/api/returns/${id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    return parseResponse(response);
}

/**
 * Explicit inspection confirmation. Stock is NEVER restored by a status
 * change alone — the backend requires `inspected: true` alongside the
 * return's CURRENT status (a same-status call), then restores stock in
 * the same transaction.
 *
 * Returns { return: <detail, stockRestored: [...]> }.
 */
export async function confirmReturnInspection(id, currentStatus) {
    return updateReturnStatus(id, { status: currentStatus, inspected: true });
}

/**
 * Record a manual refund that has already been verified as paid out of
 * band. No payment provider is contacted — this only records the refund
 * against the return.
 *
 * `payload` is exactly { amount, method, reference, refundedAt } and the
 * return must be in `refund_pending`.
 *
 * Returns { return: <detail> }.
 */
export async function recordRefund(id, payload) {
    const response = await fetch(`${API_URL}/api/returns/${id}/refund`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    return parseResponse(response);
}
