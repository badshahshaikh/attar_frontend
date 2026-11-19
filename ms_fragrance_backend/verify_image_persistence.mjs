import app from './src/app.js';
import database from './src/db.js';
import jwt from 'jsonwebtoken';
import { config } from './src/config/env.js';

const { query, closeDb } = database;
const JWT_SECRET = config.auth.jwtSecret;

const PRODUCT_ID = 142;
const TEST_IMAGE_URL =
    'https://example.com/generated/oud-marj-142.png';
const TOKEN = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, JWT_SECRET, {
    expiresIn: '15m',
});

function headers() {
    return {
        'Content-Type': 'application/json',
        Cookie: `jwt=${TOKEN}`,
    };
}

async function dbImageUrl(id) {
    const r = await query('SELECT image_url, image_urls, name FROM products WHERE id = $1', [id]);
    return r.rows[0];
}

let server;
let original;

async function put(id, body) {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/products/${id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json };
}

async function postProduct(body) {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/products`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json };
}

let PORT;

async function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(`ASSERT FAIL: ${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
    console.log(`  PASS: ${msg}`);
}

async function main() {
    try {
        original = await dbImageUrl(PRODUCT_ID);
        console.log('Original product 142 row:', JSON.stringify(original));

        // ── Test 1: update ONLY imageUrl ──
        const r1 = await put(PRODUCT_ID, { imageUrl: TEST_IMAGE_URL });
        await assertEqual(r1.status, 200, 'PUT image-only returns 200');
        await assertEqual(r1.body.imageUrl, TEST_IMAGE_URL, 'API response echoes imageUrl');
        const after1 = await dbImageUrl(PRODUCT_ID);
        await assertEqual(after1.image_url, TEST_IMAGE_URL, 'DB image_url persisted after image-only update');

        // ── Test 2: text + imageUrl together ──
        const r2 = await put(PRODUCT_ID, { name: 'Oud Marj Updated', imageUrl: TEST_IMAGE_URL });
        await assertEqual(r2.status, 200, 'PUT text+image returns 200');
        await assertEqual(r2.body.name, 'Oud Marj Updated', 'name updated');
        const after2 = await dbImageUrl(PRODUCT_ID);
        await assertEqual(after2.image_url, TEST_IMAGE_URL, 'image_url preserved when text+image updated');

        // ── Test 3: omit imageUrl → existing image preserved ──
        const r3 = await put(PRODUCT_ID, { name: 'Oud Marj Final' });
        await assertEqual(r3.status, 200, 'PUT without imageUrl returns 200');
        const after3 = await dbImageUrl(PRODUCT_ID);
        await assertEqual(after3.image_url, TEST_IMAGE_URL, 'image_url preserved when imageUrl omitted');

        // ── Test 4: explicit null clears image ──
        const r4 = await put(PRODUCT_ID, { imageUrl: null });
        await assertEqual(r4.status, 200, 'PUT imageUrl null returns 200');
        const after4 = await dbImageUrl(PRODUCT_ID);
        await assertEqual(after4.image_url, null, 'DB image_url is NULL after explicit null');

        // ── Test 5: empty string clears image ──
        const r5 = await put(PRODUCT_ID, { imageUrl: '' });
        await assertEqual(r5.status, 200, 'PUT imageUrl empty string returns 200');
        const after5 = await dbImageUrl(PRODUCT_ID);
        await assertEqual(after5.image_url, null, 'DB image_url is NULL after empty string');

        // ── Test 6: create with imageUrl ──
        const created = await postProduct({
            name: 'Temp Image Product', brand: 'MS Fragrance', fragranceFamily: 'Oud', price: 99,
            imageUrl: TEST_IMAGE_URL,
        });
        await assertEqual(created.status, 201, 'POST create with imageUrl returns 201');
        const createdId = created.body.id;
        const afterCreate = await dbImageUrl(createdId);
        await assertEqual(afterCreate.image_url, TEST_IMAGE_URL, 'DB image_url persisted on create');
        await query('DELETE FROM products WHERE id = $1', [createdId]);
        console.log('  PASS: temp created product cleaned up');

        console.log('\nALL LIVE PERSISTENCE CHECKS PASSED');
    } finally {
        // Restore product 142 to its original image_url (NULL)
        try {
            await query('UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2', [original && original.image_url, PRODUCT_ID]);
            const restored = await dbImageUrl(PRODUCT_ID);
            console.log('\nRestored product 142 image_url to:', JSON.stringify(restored.image_url));
        } catch (e) {
            console.error('Restore failed:', e.message);
        }
        try { await closeDb(); } catch { }
        if (server) server.close(() => process.exit(0));
        else process.exit(0);
    }
}

server = app.listen(0, async () => {
    PORT = server.address().port;
    console.log('Test server listening on', PORT);
    main().catch((err) => {
        console.error('LIVE VERIFICATION FAILED:', err);
        process.exit(1);
    });
});
