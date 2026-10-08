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
 * Fetch registered customers for the admin panel (paginated, searchable).
 * Mirrors the fetchProducts admin pattern.
 */
export async function fetchCustomers({ page = 1, limit = 10, search = '' } = {}) {
    const params = new URLSearchParams();

    params.set('page', page);
    params.set('limit', limit);

    if (search) {
        params.set('search', search);
    }

    const response = await fetch(`${API_URL}/api/users?${params.toString()}`, {
        credentials: 'include',
    });

    return parseResponse(response);
}