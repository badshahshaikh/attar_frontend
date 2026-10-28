import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    listSeoSettings,
    getSeoSetting,
    createSeoSetting,
    updateSeoSetting,
    deleteSeoSetting,
    getPublicSeo,
} from '../seoService';
import { API_URL } from '../../config/api';

const ok = (data, status = 200) => ({ ok: true, status, json: async () => data });
const fail = (status, data) => ({ ok: false, status, json: async () => data });

describe('seoService', () => {
    let fetchMock;
    beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('lists SEO settings with credentials', async () => {
        const payload = [{ route_path: '/shop' }];
        fetchMock.mockResolvedValue(ok(payload));
        const result = await listSeoSettings();
        expect(result).toEqual(payload);
        expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/seo`, { credentials: 'include' });
    });

    it('gets a single SEO setting by route (encoded)', async () => {
        const payload = { route_path: '/shop' };
        fetchMock.mockResolvedValue(ok(payload));
        const result = await getSeoSetting('/shop');
        expect(result).toEqual(payload);
        expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/seo/%2Fshop`, { credentials: 'include' });
    });

    it('creates an SEO setting', async () => {
        const payload = { route_path: '/about', page_type: 'shop' };
        const created = { ...payload, id: 1 };
        fetchMock.mockResolvedValue(ok(created, 201));
        const result = await createSeoSetting(payload);
        expect(result).toEqual(created);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe(`${API_URL}/api/seo`);
        expect(options.method).toBe('POST');
        expect(options.credentials).toBe('include');
        expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
        expect(JSON.parse(options.body)).toEqual(payload);
    });

    it('updates an SEO setting by route', async () => {
        const payload = { seo_title: 'New' };
        const updated = { route_path: '/shop', ...payload };
        fetchMock.mockResolvedValue(ok(updated));
        const result = await updateSeoSetting('/shop', payload);
        expect(result).toEqual(updated);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe(`${API_URL}/api/seo/%2Fshop`);
        expect(options.method).toBe('PUT');
    });

    it('deletes an SEO setting by route', async () => {
        fetchMock.mockResolvedValue(ok({ success: true }));
        await deleteSeoSetting('/shop');
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe(`${API_URL}/api/seo/%2Fshop`);
        expect(options.method).toBe('DELETE');
    });

    it('fetches public SEO without credentials', async () => {
        const payload = { seo_title: 'Public' };
        fetchMock.mockResolvedValue(ok(payload));
        const result = await getPublicSeo('/product/5');
        expect(result).toEqual(payload);
        expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/seo/public/%2Fproduct%2F5`);
    });

    it('surfaces backend error message and status', async () => {
        fetchMock.mockResolvedValue(fail(400, { error: 'Bad route', details: ['x'] }));
        await expect(createSeoSetting({})).rejects.toMatchObject({ message: 'Bad route', status: 400, details: ['x'] });
    });
});