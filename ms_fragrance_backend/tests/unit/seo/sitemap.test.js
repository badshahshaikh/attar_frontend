import test from 'node:test';
import assert from 'node:assert/strict';
import GetSitemapUseCase from '../../../src/modules/seo/application/use-cases/GetSitemapUseCase.js';

function repoWith(published) {
    return { listPublished: async () => published };
}

test('excludes noindex and non-indexable routes', async () => {
    const useCase = new GetSitemapUseCase({
        seoRepository: repoWith([
            { route_path: '/', robots: 'index,follow', canonical_url: null, updated_at: '2026-01-01T00:00:00Z' },
            { route_path: '/cart', robots: 'index,follow', canonical_url: null, updated_at: null },
            { route_path: '/secret', robots: 'noindex,follow', canonical_url: null, updated_at: null },
        ]),
        listProducts: async () => [],
        siteUrl: 'https://example.com',
    });
    const { urls } = await useCase.execute();
    const locs = urls.map((u) => u.loc);
    assert.ok(locs.includes('https://example.com/'));
    assert.ok(!locs.includes('https://example.com/cart'));
    assert.ok(!locs.includes('https://example.com/secret'));
});

test('includes products and uses canonical urls', async () => {
    const useCase = new GetSitemapUseCase({
        seoRepository: repoWith([
            { route_path: '/product/7', robots: 'index,follow', canonical_url: 'https://example.com/p/7', updated_at: null, product_id: 7 },
        ]),
        listProducts: async () => [{ id: 7, updated_at: '2026-02-02T00:00:00Z' }, { id: 9 }],
        siteUrl: 'https://example.com',
    });
    const { urls } = await useCase.execute();
    const locs = urls.map((u) => u.loc);
    assert.ok(locs.includes('https://example.com/p/7'));
    assert.ok(locs.includes('https://example.com/product/9'));
});

test('default core pages present', async () => {
    const useCase = new GetSitemapUseCase({
        seoRepository: repoWith([]),
        listProducts: async () => [],
        siteUrl: 'https://example.com',
    });
    const { urls } = await useCase.execute();
    const locs = urls.map((u) => u.loc);
    assert.ok(locs.includes('https://example.com/'));
    assert.ok(locs.includes('https://example.com/shop'));
    assert.ok(locs.includes('https://example.com/collections'));
    assert.ok(locs.includes('https://example.com/about'));
});