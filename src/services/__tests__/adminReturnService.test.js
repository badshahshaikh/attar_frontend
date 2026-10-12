import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    fetchReturns,
    fetchReturnDetails,
    checkReturnEligibility,
    createReturn,
    updateReturnStatus,
    confirmReturnInspection,
    recordRefund,
} from '../adminReturnService';
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

describe('adminReturnService', () => {
    let fetchMock;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('fetchReturns', () => {
        it('requests the list with pagination, search and status filters', async () => {
            const payload = {
                returns: [{ id: 1 }],
                pagination: { page: 2, totalPages: 3, totalReturns: 25 },
            };
            fetchMock.mockResolvedValue(ok(payload));

            const result = await fetchReturns({ page: 2, limit: 5, search: 'RET', status: 'approved' });

            expect(result).toEqual(payload);
            const [url, options] = fetchMock.mock.calls[0];
            expect(url).toBe(`${API_URL}/api/returns?page=2&limit=5&search=RET&status=approved`);
            expect(options).toEqual({ credentials: 'include' });
        });

        it('omits empty optional filters and defaults to page 1 / limit 10', async () => {
            fetchMock.mockResolvedValue(ok({ returns: [], pagination: {} }));

            await fetchReturns();

            const [url] = fetchMock.mock.calls[0];
            expect(url).toBe(`${API_URL}/api/returns?page=1&limit=10`);
        });
    });

    describe('fetchReturnDetails', () => {
        it('GETs a single return by id with credentials', async () => {
            const payload = { return: { id: 7, returnNumber: 'RET-0007' } };
            fetchMock.mockResolvedValue(ok(payload));

            const result = await fetchReturnDetails(7);

            expect(result).toEqual(payload);
            expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/returns/7`, {
                credentials: 'include',
            });
        });

        it('throws an error carrying the backend message and status code', async () => {
            fetchMock.mockResolvedValue(fail(404, { error: 'Return not found' }));

            await expect(fetchReturnDetails(99)).rejects.toMatchObject({
                message: 'Return not found',
                status: 404,
            });
        });
    });

    describe('checkReturnEligibility', () => {
        it('encodes the orderId in the eligibility query string', async () => {
            const payload = { eligible: true, items: [] };
            fetchMock.mockResolvedValue(ok(payload));

            const result = await checkReturnEligibility(10);

            expect(result).toEqual(payload);
            expect(fetchMock).toHaveBeenCalledWith(
                `${API_URL}/api/returns/eligibility?orderId=10`,
                { credentials: 'include' }
            );
        });
    });

    describe('createReturn', () => {
        it('POSTs the exact backend payload and returns the created detail', async () => {
            const payload = {
                orderId: 11,
                items: [{ orderItemId: 22, quantity: 1 }],
                customerReason: 'Wrong scent',
                internalNotes: 'chat support',
                unopenedConfirmed: true,
            };
            const created = { return: { id: 7, returnNumber: 'RET-0007' } };
            fetchMock.mockResolvedValue(ok(created, 201));

            const result = await createReturn(payload);

            expect(result).toEqual(created);
            const [url, options] = fetchMock.mock.calls[0];
            expect(url).toBe(`${API_URL}/api/returns`);
            expect(options.method).toBe('POST');
            expect(options.credentials).toBe('include');
            expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
            expect(JSON.parse(options.body)).toEqual(payload);
        });

        it('surfaces backend validation messages with their status', async () => {
            fetchMock.mockResolvedValue(fail(422, { error: 'Order has no returnable items' }));

            await expect(createReturn({ orderId: 1, items: [] })).rejects.toMatchObject({
                message: 'Order has no returnable items',
                status: 422,
            });
        });
    });

    describe('updateReturnStatus', () => {
        it('PATCHes { status, note } for the given id', async () => {
            const updated = { return: { id: 3, status: 'pickup_pending' } };
            fetchMock.mockResolvedValue(ok(updated));

            const result = await updateReturnStatus(3, { status: 'pickup_pending', note: 'ok' });

            expect(result).toEqual(updated);
            const [url, options] = fetchMock.mock.calls[0];
            expect(url).toBe(`${API_URL}/api/returns/3/status`);
            expect(options.method).toBe('PATCH');
            expect(JSON.parse(options.body)).toEqual({ status: 'pickup_pending', note: 'ok' });
        });
    });

    describe('confirmReturnInspection', () => {
        it('sends a same-status PATCH with inspected: true (stock restore gate)', async () => {
            fetchMock.mockResolvedValue(ok({ return: { id: 3, status: 'received' } }));

            await confirmReturnInspection(3, 'received');

            const [url, options] = fetchMock.mock.calls[0];
            expect(url).toBe(`${API_URL}/api/returns/3/status`);
            expect(options.method).toBe('PATCH');
            expect(JSON.parse(options.body)).toEqual({ status: 'received', inspected: true });
        });
    });

    describe('recordRefund', () => {
        it('POSTs the refund payload to the refund endpoint', async () => {
            const payload = {
                amount: 499,
                method: 'upi',
                reference: 'txn-1',
                refundedAt: '2026-10-02T10:00:00.000Z',
            };
            const recorded = { return: { id: 5, status: 'refunded', refundAmount: 499 } };
            fetchMock.mockResolvedValue(ok(recorded));

            const result = await recordRefund(5, payload);

            expect(result).toEqual(recorded);
            const [url, options] = fetchMock.mock.calls[0];
            expect(url).toBe(`${API_URL}/api/returns/5/refund`);
            expect(options.method).toBe('POST');
            expect(JSON.parse(options.body)).toEqual(payload);
        });

        it('propagates the conflict error when the return is not refundable', async () => {
            fetchMock.mockResolvedValue(
                fail(409, { error: 'Return is not refundable from status requested' })
            );

            await expect(recordRefund(5, { amount: 10, method: 'manual' })).rejects.toMatchObject({
                message: 'Return is not refundable from status requested',
                status: 409,
            });
        });
    });
});

