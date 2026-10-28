import test from 'node:test';
import assert from 'node:assert/strict';
import GetSeoSettingsUseCase from '../../../src/modules/seo/application/use-cases/GetSeoSettingsUseCase.js';

function repoWith(record) {
    return {
        getPublicByRoute: async () => record,
        getByProductId: async () => null,
    };
}

test('returns site defaults when no SEO record exists', async () => {
    const useCase = new GetSeoSettingsUseCase({ seoRepository: repoWith(null) });
    const seo = await useCase.execute('/');

    assert.equal(seo.page_type, 'homepage');
    assert.equal(seo.route_path, '/');
    assert.equal(seo.seo_title, 'MS Fragrance — Pure Attars & Natural Fragrances');
    assert.equal(seo.canonical_url, 'https://msfragrance.in/');
    assert.equal(seo.robots, 'index,follow');
    assert.equal(seo.twitter_card, 'summary_large_image');
});

test('merges record fields over site defaults', async () => {
    const record = {
        page_type: 'homepage',
        route_path: '/',
        seo_title: 'Custom Title',
        canonical_url: 'https://msfragrance.in/custom',
    };
    const useCase = new GetSeoSettingsUseCase({ seoRepository: repoWith(record) });
    const seo = await useCase.execute('/');

    assert.equal(seo.seo_title, 'Custom Title');
    assert.equal(seo.canonical_url, 'https://msfragrance.in/custom');
    // defaults still fill in the gaps
    assert.equal(seo.meta_description, 'Pure attars and natural fragrances.');
});

test('derives product defaults from product data', async () => {
    const useCase = new GetSeoSettingsUseCase({
        seoRepository: repoWith(null),
        getProductById: async () => ({
            id: 42,
            name: 'Oud Royale',
            description: 'A rich, woody oud attar.',
            price: 1299,
            in_stock: true,
            image_url: 'https://msfragrance.in/uploads/oud.jpg',
        }),
    });

    const seo = await useCase.execute('/product/42');

    assert.equal(seo.page_type, 'product');
    assert.equal(seo.seo_title, 'Oud Royale | MS Fragrance');
    assert.equal(seo.meta_description, 'A rich, woody oud attar.');
    assert.equal(seo.og_title, 'Oud Royale');
    assert.equal(seo.og_image, 'https://msfragrance.in/uploads/oud.jpg');
    assert.equal(seo.canonical_url, 'https://msfragrance.in/product/42');
    assert.ok(seo.structured_data['@type'] === 'Product');
    assert.equal(seo.structured_data.name, 'Oud Royale');
    assert.equal(seo.structured_data.url, 'https://msfragrance.in/product/42');
});

test('product JSON-LD includes verified price and availability', async () => {
    const useCase = new GetSeoSettingsUseCase({
        seoRepository: repoWith(null),
        getProductById: async () => ({
            id: 1,
            name: 'Musk Classic',
            price: 799,
            in_stock: false,
        }),
    });

    const seo = await useCase.execute('/product/1');
    assert.equal(seo.structured_data.offers.price, '799');
    assert.equal(seo.structured_data.offers.priceCurrency, 'INR');
    assert.equal(
        seo.structured_data.offers.availability,
        'https://schema.org/OutOfStock'
    );
});

test('product JSON-LD omits price when price is missing', async () => {
    const useCase = new GetSeoSettingsUseCase({
        seoRepository: repoWith(null),
        getProductById: async () => ({
            id: 1,
            name: 'Musk Classic',
        }),
    });

    const seo = await useCase.execute('/product/1');
    assert.equal(seo.structured_data.offers, undefined);
});

test('falls back to product-linked record when direct route record missing', async () => {
    const productRecord = {
        page_type: 'product',
        route_path: '/product/42',
        seo_title: 'Custom Oud Title',
        meta_description: 'Custom description.',
        product_id: 42,
    };
    const useCase = new GetSeoSettingsUseCase({
        seoRepository: {
            getPublicByRoute: async () => null,
            getByProductId: async () => productRecord,
        },
        getProductById: async () => ({
            id: 42,
            name: 'Oud Royale',
            description: 'A rich oud.',
        }),
    });

    const seo = await useCase.execute('/product/42');
    assert.equal(seo.seo_title, 'Custom Oud Title');
    assert.equal(seo.meta_description, 'Custom description.');
    assert.equal(seo.route_path, '/product/42');
});
