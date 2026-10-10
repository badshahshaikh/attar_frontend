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
 * Fetch orders for the admin panel (paginated, searchable, filterable).
 * Mirrors the fetchCustomers/fetchProducts admin patterns.
 */
export async function fetchOrders({
    page = 1,
    limit = 10,
    search = '',
    status = '',
    paymentStatus = ''
} = {}) {
    const params = new URLSearchParams();

    params.set('page', page);
    params.set('limit', limit);

    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (paymentStatus) params.set('paymentStatus', paymentStatus);

    const response = await fetch(`${API_URL}/api/orders?${params.toString()}`, {
        credentials: 'include',
    });

    return parseResponse(response);
}

/**
 * Fetch one order with items and shipping address for the View action.
 */
export async function fetchOrderDetails(id) {
    const response = await fetch(`${API_URL}/api/orders/${id}`, {
        credentials: 'include',
    });

    return parseResponse(response);
}

/**
 * Update a single order status field.
 *
 * `payload` is exactly one of `{ status }` or `{ paymentStatus }` — the two are
 * independent on the backend, so changing one never affects the other. The
 * server validates the value, persists it, and returns the updated order, which
 * the admin panel renders so the UI always reflects what was saved.
 */
export async function updateOrderStatus(id, payload) {
    const response = await fetch(`${API_URL}/api/orders/${id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    return parseResponse(response);
}

/**
 * Download the invoice PDF for an order.
 *
 * The PDF is generated on the backend from the saved order (totals, customer
 * details and statuses are server-authoritative) and streamed with a
 * descriptive `Content-Disposition` filename. We read the raw bytes and trigger
 * a browser download so the file is saved even though the endpoint returns a
 * binary body rather than JSON.
 *
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function downloadInvoice(id) {
    const response = await fetch(`${API_URL}/api/orders/${id}/invoice`, {
        credentials: 'include',
    });

    if (!response.ok) {
        // The endpoint returns JSON errors, so surface the server message.
        const data = await response.json().catch(() => ({}));
        const error = new Error(data.error || data.message || 'Unable to generate the invoice.');
        error.status = response.status;
        throw error;
    }

    const blob = await response.blob();
    // Prefer the server filename; fall back to a safe default.
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const filename = match ? match[1] : `MS-Fragrances-Invoice-${id}.pdf`;

    return { blob, filename };
}