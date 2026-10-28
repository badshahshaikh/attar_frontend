import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeoRepository } from '../../../src/modules/seo/seo.repository.js';

function makeQuery(canned) {
    const calls = [];
    return {
        calls,
        async query(text, values) {
            calls.push({ text, values });
            const upper = String(text).toUpperCase();
            if (upper.startsWith('SELECT') && upper.includes('WHERE ROUTE_PATH')) {
                return { rows: canned.byRoute || [] };
            }
            if (upper.startsWith('SELECT') && upper.includes('WHERE PAGE_TYPE')) {
                return { rows: canned.byProduct || [] };
            }
            if (upper.startsWith('SELECT') && upper.includes('ORDER BY PAGE_TYPE')) {
                return { rows: canned.all || [] };
            }
            if (upper.startsWith('INSERT')) {
                return { rows: [canned.inserted || {}] };
            }
            if (upper.startsWith('UPDATE')) {
                return { rows: [canned.updated || null] };
            }
            if (upper.startsWith('DELETE')) {
                return { rows: canned.deleted ? [{ id: canned.deleted }] : [] };
            }
            return { rows: [] };
        },
    };
}

test('getByRoute returns the full record or null', async () => {
    const row = {
        id: 1,
        page_type: 'homepage',
        route_path: '/',
        seo_title: 'Home',
        is_published: true,
    };
    const pool = makeQuery({ byRoute: [row] });
    const repo = createSeoRepository({ query: pool.query });

    const found = await repo.getByRoute('/');
    assert.deepEqual(found, row);

    const pool2 = makeQuery({ byRoute: [] });
    const repo2 = createSeoRepository({ query: pool2.query });
    const missing = await repo2.getByRoute('/nope');
    assert.equal(missing, null);
});

test('getPublicByRoute strips internal fields', async () => {
    const fullRow = {
        id: 7,
        page_type: 'shop',
        route_path: '/shop',
        seo_title: 'Shop',
        product_id: 3,
        is_published: false,
        created_at: '2026-01-01',
    };
    const pool = makeQuery({ byRoute: [fullRow] });
    const repo = createSeoRepository({ query: pool.query });

    const publicRow = await repo.getPublicByRoute('/shop');
    assert.equal(publicRow.id, undefined, 'id must not be exposed publicly');
    assert.equal(publicRow.product_id, undefined, 'product_id must not be exposed publicly');
    assert.equal(publicRow.page_type, 'shop');
    assert.equal(publicRow.seo_title, 'Shop');
});

test('getByProductId returns product-linked record or null', async () => {
    const row = {
        id: 2,
        page_type: 'product',
        route_path: '/product/42',
        product_id: 42,
    };
    const pool = makeQuery({ byProduct: [row] });
    const repo = createSeoRepository({ query: pool.query });

    const found = await repo.getByProductId(42);
    assert.deepEqual(found, row);

    const pool2 = makeQuery({ byProduct: [] });
    const repo2 = createSeoRepository({ query: pool2.query });
    const missing = await repo2.getByProductId(999);
    assert.equal(missing, null);
});

test('getAll returns all rows ordered', async () => {
    const rows = [
        { id: 1, route_path: '/', page_type: 'homepage' },
        { id: 2, route_path: '/shop', page_type: 'shop' },
    ];
    const pool = makeQuery({ all: rows });
    const repo = createSeoRepository({ query: pool.query });

    const all = await repo.getAll();
    assert.deepEqual(all, rows);
});

test('insert returns the created row', async () => {
    const created = { id: 1, route_path: '/shop', page_type: 'shop' };
    const pool = makeQuery({ inserted: created });
    const repo = createSeoRepository({ query: pool.query });

    const result = await repo.insert({
        page_type: 'shop',
        route_path: '/shop',
        seo_title: 'Shop',
    });
    assert.deepEqual(result, created);
    assert.equal(pool.calls[0].values.length, 16);
});

test('updateByRoute updates fields and returns the row, or null when missing', async () => {
    const updated = { id: 1, route_path: '/shop', seo_title: 'New' };
    const pool = makeQuery({ updated });
    const repo = createSeoRepository({ query: pool.query });

    const result = await repo.updateByRoute('/shop', { seo_title: 'New' });
    assert.deepEqual(result, updated);
    assert.equal(pool.calls[0].values[pool.calls[0].values.length - 1], '/shop');

    const pool2 = makeQuery({ updated: null });
    const repo2 = createSeoRepository({ query: pool2.query });
    const missing = await repo2.updateByRoute('/nope', { seo_title: 'New' });
    assert.equal(missing, null);
});

test('deleteByRoute returns the deleted row id or null', async () => {
    const pool = makeQuery({ deleted: 5 });
    const repo = createSeoRepository({ query: pool.query });

    const deleted = await repo.deleteByRoute('/shop');
    assert.deepEqual(deleted, { id: 5 });

    const pool2 = makeQuery({ deleted: null });
    const repo2 = createSeoRepository({ query: pool2.query });
    const missing = await repo2.deleteByRoute('/nope');
    assert.equal(missing, null);
});

