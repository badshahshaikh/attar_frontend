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