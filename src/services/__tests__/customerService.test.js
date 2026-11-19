import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    loginCustomer,
    registerCustomer,
    fetchCustomer,
    logoutCustomer,
    changeCustomerPassword,
    fetchAddresses,
    fetchOrders,
    getCustomerToken,
    setCustomerToken,
    clearCustomerToken,
} from '../customerService';
import { API_URL } from '../../config/api';

const ok = (data, status = 200) => ({
    ok: true,
    status,
    json: async () => data,
});

const fail = (status, data) => ({
    ok: false,
    status,
    json: async () => data,
});

describe('customerService — Bearer token fallback & storage lifecycle', () => {
    let fetchMock;

    beforeEach(() => {
        sessionStorage.clear();
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        sessionStorage.clear();
        vi.unstubAllGlobals();
    });

    it('loginCustomer saves token to sessionStorage and returns user', async () => {
        const mockResponse = {
            success: true,
            user: { id: 42, email: 'zoya@example.com', fullName: 'Zoya' },
            token: 'jwt-customer-session-token',
        };
        fetchMock.mockResolvedValue(ok(mockResponse));

        const user = await loginCustomer('zoya@example.com', 'secret123');

        expect(user).toEqual(mockResponse.user);
        expect(getCustomerToken()).toBe('jwt-customer-session-token');
        expect(sessionStorage.getItem('customer_jwt_token')).toBe('jwt-customer-session-token');

        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe(`${API_URL}/api/auth/customer/login`);
        expect(options.method).toBe('POST');
        expect(options.credentials).toBe('include');
        expect(JSON.parse(options.body)).toEqual({ email: 'zoya@example.com', password: 'secret123' });
    });

    it('registerCustomer saves token to sessionStorage and returns user', async () => {
        const mockResponse = {
            success: true,
            user: { id: 43, email: 'new@example.com', fullName: 'New Customer' },
            token: 'jwt-register-token',
        };
        fetchMock.mockResolvedValue(ok(mockResponse, 201));

        const payload = { fullName: 'New Customer', email: 'new@example.com', password: 'pass', phone: '123' };
        const user = await registerCustomer(payload);

        expect(user).toEqual(mockResponse.user);
        expect(getCustomerToken()).toBe('jwt-register-token');
    });

    it('outbound requests attach Authorization: Bearer header when token exists', async () => {
        setCustomerToken('my-saved-jwt-token');
        fetchMock.mockResolvedValue(ok({ user: { id: 42 } }));

        await fetchCustomer();

        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe(`${API_URL}/api/auth/customer/me`);
        expect(options.credentials).toBe('include');
        expect(options.headers['Authorization']).toBe('Bearer my-saved-jwt-token');
    });

    it('sendAccount attaches Authorization: Bearer header when token exists', async () => {
        setCustomerToken('account-jwt-token');
        fetchMock.mockResolvedValue(ok({ addresses: [{ id: 1, city: 'Mumbai' }] }));

        const addresses = await fetchAddresses();

        expect(addresses).toHaveLength(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe(`${API_URL}/api/customer/addresses`);
        expect(options.credentials).toBe('include');
        expect(options.headers['Authorization']).toBe('Bearer account-jwt-token');
    });

    it('outbound requests omit Authorization header when no token is in storage', async () => {
        clearCustomerToken();
        fetchMock.mockResolvedValue(ok({ orders: [] }));

        const orders = await fetchOrders();

        expect(orders).toEqual([]);
        const [, options] = fetchMock.mock.calls[0];
        expect(options.credentials).toBe('include');
        expect(options.headers['Authorization']).toBeUndefined();
    });

    it('logoutCustomer clears token from sessionStorage', async () => {
        setCustomerToken('active-token-to-be-cleared');
        fetchMock.mockResolvedValue(ok({ success: true }));

        await logoutCustomer();

        expect(getCustomerToken()).toBeNull();
        expect(sessionStorage.getItem('customer_jwt_token')).toBeNull();
    });

    it('changeCustomerPassword clears token from sessionStorage on success', async () => {
        setCustomerToken('active-token');
        fetchMock.mockResolvedValue(ok({ success: true }));

        await changeCustomerPassword('oldPass', 'newPass');

        expect(getCustomerToken()).toBeNull();
    });

    it('automatically clears token from sessionStorage when response is 401', async () => {
        setCustomerToken('expired-stale-token');
        fetchMock.mockResolvedValue(fail(401, { message: 'Session expired' }));

        await expect(fetchCustomer()).rejects.toThrow('Session expired');

        expect(getCustomerToken()).toBeNull();
        expect(sessionStorage.getItem('customer_jwt_token')).toBeNull();
    });
});
