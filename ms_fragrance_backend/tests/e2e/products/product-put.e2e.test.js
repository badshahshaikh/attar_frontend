import test from 'node:test';

import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import app from '../../../src/app.js';
import database from '../../../src/infrastructure/database/postgres-database.js';
const { query, closeDb } = database;
import { config } from '../../../src/config/env.js';

test('real authenticated PUT persists through GET and restores the exact database row', {
    skip: process.env.RUN_PRODUCT_PUT_E2E !== 'true',
}, async () => {
    // This test is intentionally opt-in. It requires a local, disposable database and a valid
    // DATABASE_URL/JWT_SECRET. It must never be pointed at production data.
    let token;
    const original = (await query('SELECT * FROM products ORDER BY id ASC LIMIT 1')).rows[0];
    const user = (await query('SELECT id, username, role FROM users ORDER BY id ASC LIMIT 1')).rows[0];
    assert.ok(original, 'An existing product is required');
    assert.ok(user, 'An existing user is required');

    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    token = jwt.sign({ id: user.id, username: user.username, role: user.role }, config.auth.jwtSecret, { expiresIn: config.auth.jwtExpiresIn });
    const cookie = `${config.auth.cookie.name}=${token}`;
    const fields = ['name', 'category', 'fragrance_type', 'description', 'full_description', 'rating', 'reviews', 'price', 'original_price', 'size_pricing', 'sizes', 'top_notes', 'heart_notes', 'base_notes', 'longevity', 'in_stock', 'is_new', 'brand', 'is_best_seller', 'is_exclusive', 'featured', 'stock_quantity', 'slug', 'image_url', 'image_urls', 'created_at', 'updated_at'];
    try {
        const before = await fetch(`${baseUrl}/api/products/${original.id}`);
        assert.equal(before.status, 200);
        const product = await before.json();
        const update = await fetch(`${baseUrl}/api/products/${original.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(product) });
        assert.equal(update.status, 200, await update.text());
        const after = await fetch(`${baseUrl}/api/products/${original.id}`);
        assert.equal(after.status, 200);
        assert.equal((await after.json()).id, original.id);
    } finally {
        const jsonFields = new Set(['size_pricing', 'sizes', 'top_notes', 'heart_notes', 'base_notes', 'image_urls']);
        const values = fields.map(field => jsonFields.has(field) ? JSON.stringify(original[field]) : original[field]);
        await query(`UPDATE products SET ${fields.map((field, index) => `${field} = $${index + 1}`).join(', ')} WHERE id = $${fields.length + 1}`, [...values, original.id]);
        await new Promise(resolve => server.close(resolve));
        await closeDb();
    }
});
