import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SeoHead from '../SeoHead';
import { clearSeoMetadataCache } from '../../../hooks/useSeoMetadata';

vi.mock('../../../services/seoService', () => ({
    getPublicSeo: vi.fn(),
}));

import * as seoService from '../../../services/seoService';

const sample = {
    seo_title: 'Shop Title',
    meta_description: 'Shop desc',
    canonical_url: 'https://msfragrance.in/shop',
    robots: 'index,follow',
    og_title: 'OG Shop',
    og_description: 'OG desc',
    og_image: 'https://img/x.png',
    twitter_card: 'summary_large_image',
    twitter_title: 'TW Shop',
    twitter_description: 'TW desc',
    twitter_image: 'https://img/tw.png',
    structured_data: { '@type': 'WebPage', name: 'Shop' },
};

function renderAt(path) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="*" element={<SeoHead />} />
            </Routes>
        </MemoryRouter>
    );
}

describe('SeoHead', () => {
    beforeEach(() => {
        clearSeoMetadataCache();
        vi.clearAllMocks();
        document.head.querySelectorAll('meta,link[rel="canonical"],script#seo-jsonld').forEach((n) => n.remove());
        document.getElementById('seo-jsonld')?.remove();
        seoService.getPublicSeo.mockResolvedValue(sample);
    });
    afterEach(() => {
        document.getElementById('seo-jsonld')?.remove();
    });

    it('fetches public SEO and sets title/meta/canonical/og/twitter', async () => {
        renderAt('/shop');
        await waitFor(() => expect(seoService.getPublicSeo).toHaveBeenCalledWith('/shop'));
        await waitFor(() => expect(document.title).toBe('Shop Title'));
        expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Shop desc');
        expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://msfragrance.in/shop');
        expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('OG Shop');
        expect(document.head.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe('summary_large_image');
        const scripts = document.head.querySelectorAll('script#seo-jsonld');
        expect(scripts.length).toBe(1);
        expect(JSON.parse(scripts[0].textContent)).toEqual(sample.structured_data);
    });

    it('marks non-indexable route as noindex and does not fetch', async () => {
        renderAt('/cart');
        await new Promise((r) => setTimeout(r, 50));
        expect(seoService.getPublicSeo).not.toHaveBeenCalled();
        expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow');
    });

    it('falls back to route URL for canonical when missing', async () => {
        seoService.getPublicSeo.mockResolvedValue({ ...sample, canonical_url: '' });
        renderAt('/about');
        await waitFor(() => expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toContain('/about'));
    });

    it('removes JSON-LD when structured_data empty', async () => {
        seoService.getPublicSeo.mockResolvedValue({ ...sample, structured_data: {} });
        renderAt('/about');
        await waitFor(() => expect(document.title).toBe('Shop Title'));
        expect(document.getElementById('seo-jsonld')).toBeNull();
    });

    it('cleans up JSON-LD script on unmount', async () => {
        const { unmount } = renderAt('/shop');
        await waitFor(() => expect(document.getElementById('seo-jsonld')).not.toBeNull());
        unmount();
        expect(document.getElementById('seo-jsonld')).toBeNull();
    });
});