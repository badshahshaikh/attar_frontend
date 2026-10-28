import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeoController } from '../../../src/modules/seo/seo.controller.js';

function response() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
}

test('getPublicSeo returns merged public metadata from the use case', async () => {
    const metadata = {
        page_type: 'homepage',
        route_path: '/',
        seo_title: 'MS Fragrance — Home',
        meta_description: 'Pure attars.',
        canonical_url: 'https://msfragrance.in/',
        robots: 'index,follow',
        og_title: 'MS Fragrance — Home',
        og_description: 'Pure attars.',
        og_image: '',
        twitter_card: 'summary_large_image',
        twitter_title: 'MS Fragrance — Home',
        twitter_description: 'Pure attars.',
        twitter_image: '',
        structured_data: {},
    };

    const controller = createSeoController({
        getSeoSettingsUseCase: { execute: async () => metadata },
    });

    const req = { params: { route: '/' } };
    const res = response();
    await controller.getPublicSeo(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, metadata);
});

test('getPublicSeo returns 500 when the use case fails', async () => {
    const controller = createSeoController({
        getSeoSettingsUseCase: {
            execute: async () => {
                throw new Error('db down');
            },
        },
    });

    const req = { params: { route: '/' } };
    const res = response();
    await controller.getPublicSeo(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'Failed to fetch SEO metadata');
});

test('listSeoSettings returns all SEO settings', async () => {
    const rows = [
        { id: 1, route_path: '/', page_type: 'homepage' },
        { id: 2, route_path: '/shop', page_type: 'shop' },
    ];
    const controller = createSeoController({
        listSeoSettingsUseCase: { execute: async () => rows },
    });

    const req = {};
    const res = response();
    await controller.listSeoSettings(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, rows);
});

test('createSeoSetting returns 201 and the created record', async () => {
    const created = { id: 1, route_path: '/shop', page_type: 'shop' };
    const controller = createSeoController({
        createSeoSettingsUseCase: { execute: async () => created },
    });

    const req = { body: { page_type: 'shop', route_path: '/shop' } };
    const res = response();
    await controller.createSeoSetting(req, res);

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, created);
});

test('createSeoSetting returns 400 details on validation failure', async () => {
    const error = Object.assign(
        new Error('SEO validation failed'),
        { statusCode: 400, isOperational: true, details: ['route_path is required'] }
    );
    const controller = createSeoController({
        createSeoSettingsUseCase: { execute: async () => { throw error; } },
    });

    const req = { body: {} };
    const res = response();
    await controller.createSeoSetting(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body.details, ['route_path is required']);
});

test('updateSeoSetting returns the updated record', async () => {
    const updated = { id: 1, route_path: '/shop', seo_title: 'New Title' };
    const controller = createSeoController({
        updateSeoSettingsUseCase: { execute: async () => updated },
    });

    const req = { params: { route: '/shop' }, body: { seo_title: 'New Title' } };
    const res = response();
    await controller.updateSeoSetting(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, updated);
});

test('deleteSeoSetting returns the deletion result', async () => {
    const result = { message: 'SEO setting deleted', route_path: '/shop' };
    const controller = createSeoController({
        deleteSeoSettingsUseCase: { execute: async () => result },
    });

    const req = { params: { route: '/shop' } };
    const res = response();
    await controller.deleteSeoSetting(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, result);
});
