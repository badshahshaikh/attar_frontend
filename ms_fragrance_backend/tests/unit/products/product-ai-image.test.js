import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import ProductAiService from '../../../src/shared/ai/product-ai.service.js';
import AppError from '../../../src/core/errors/AppError.js';
import {
    loadMasterProductImage,
    resolveMasterImagePath,
    DEFAULT_MASTER_IMAGE_PATH,
} from '../../../src/shared/ai/master-product-image.js';

// ── Fakes ───────────────────────────────────────────────────────────────
// A stand-in for the OpenAI client. `images.edit` records what it received so
// we can prove the master image is actually passed to the image API and that
// the prompt carries the product + fragrance details. No network, no credits.
function fakeOpenAi({ editResult } = {}) {
    const calls = { edit: [] };
    return {
        calls,
        images: {
            async edit(params) {
                calls.edit.push(params);
                return editResult || { data: [{ b64_json: 'R0lGODlhAQABAAAAACw=' }] };
            },
        },
    };
}

// A stand-in File for the master image reference (a File is a valid Uploadable
// for the SDK, but here we just need an identifiable object).
function fakeMasterFile() {
    return { name: 'ms-fragrance-master.png', type: 'image/png', __master: true };
}

function fakeLoadMasterImage(overrides = {}) {
    const state = { called: 0, ...overrides };
    return {
        state,
        load: async () => {
            state.called += 1;
            if (state.throws) throw state.throws;
            return { file: fakeMasterFile(), buffer: Buffer.from([1, 2, 3]) };
        },
    };
}

const product = {
    name: 'Royal Oud Intense',
    description: 'A deep woody oud attar',
    fragranceFamily: 'Woody',
    topNotes: 'Saffron, bergamot',
    heartNotes: 'Rose, oud',
    baseNotes: 'Amber, sandalwood',
};

// ── 1. The master image is actually passed to the image API ──────────────
test('generateProductImage passes the master reference image to images.edit', async () => {
    const client = fakeOpenAi();
    const master = fakeLoadMasterImage();
    const service = new ProductAiService({ client, loadMasterImage: master.load });

    const b64 = await service.generateProductImage(product);

    // The edit endpoint was called exactly once, with the master image as input.
    assert.equal(client.calls.edit.length, 1);
    const params = client.calls.edit[0];
    assert.ok(Array.isArray(params.image), 'image must be sent as an array of references');
    assert.equal(params.image.length, 1);
    assert.equal(params.image[0].__master, true, 'the master bottle image must be passed to the API');
    // Uses the reference-based edit operation with the GPT image model.
    assert.equal(params.model, 'gpt-image-2');
    // Returns the raw base64 PNG string (frontend contract).
    assert.equal(b64, 'R0lGODlhAQABAAAAACw=');
    // The master loader was invoked.
    assert.equal(master.state.called, 1);
});

// ── 2. Product name + fragrance details reach the prompt ─────────────────
test('the prompt includes the product name and all fragrance details', async () => {
    const client = fakeOpenAi();
    const master = fakeLoadMasterImage();
    const service = new ProductAiService({ client, loadMasterImage: master.load });

    await service.generateProductImage(product);
    const prompt = client.calls.edit[0].prompt;

    for (const fragment of [
        'Royal Oud Intense',      // product name
        'A deep woody oud attar', // description
        'Woody',                  // fragrance family
        'Saffron, bergamot',      // top notes
        'Rose, oud',              // heart notes
        'Amber, sandalwood',      // base notes
    ]) {
        assert.ok(prompt.includes(fragment), `prompt must include: ${fragment}`);
    }
});

// ── 3. Bottle identity + label-preservation rules are in the prompt ──────
test('the prompt enforces bottle identity and label preservation', async () => {
    const client = fakeOpenAi();
    const master = fakeLoadMasterImage();
    const service = new ProductAiService({ client, loadMasterImage: master.load });

    await service.generateProductImage(product);
    const prompt = client.calls.edit[0].prompt;
    const lower = prompt.toLowerCase();

    for (const fragment of [
        'silhouette',
        'amber-brown glass',
        'glossy black cap',
        'clear glass base',
        'front-facing',
        'ivory rectangular label',
        'MS FRAGRANCE',
        'سعد للعطورات',
    ]) {
        assert.ok(prompt.includes(fragment), `prompt must preserve: ${fragment}`);
    }

    assert.ok(lower.includes('do not remove') || lower.includes('do not redesign'));
    assert.ok(lower.includes('do not invent'));
    assert.ok(lower.includes('the only text that changes'));
});

// ── 4. Missing master image → clear, safe error (no path leaked) ─────────
test('generateProductImage surfaces a safe error when the master image is missing', async () => {
    const client = fakeOpenAi();
    const missing = new AppError(
        'The master product image is unavailable. Please try again later.',
        503,
        'MASTER_IMAGE_MISSING'
    );
    const master = fakeLoadMasterImage({ throws: missing });
    const service = new ProductAiService({ client, loadMasterImage: master.load });

    await assert.rejects(
        () => service.generateProductImage(product),
        (error) => {
            assert.equal(error.statusCode, 503);
            assert.equal(error.code, 'MASTER_IMAGE_MISSING');
            // No filesystem path or secret leaked in the message.
            assert.ok(!/src\/assets|:\\|\/tmp|node_modules/.test(error.message));
            return true;
        }
    );
    // The image API is never called when the master image can't be loaded.
    assert.equal(client.calls.edit.length, 0);
});

// ── 4b. The real loader never leaks the filesystem path in its error ─────
test('loadMasterProductImage throws a path-free error for a missing file', async () => {
    const previous = process.env.MASTER_PRODUCT_IMAGE_PATH;
    process.env.MASTER_PRODUCT_IMAGE_PATH = '/definitely/not/here/ms-fragrance-master.png';
    try {
        await assert.rejects(
            () => loadMasterProductImage(),
            (error) => {
                assert.equal(error.statusCode, 503);
                assert.ok(!error.message.includes('/definitely/not/here'));
                return true;
            }
        );
    } finally {
        if (previous === undefined) delete process.env.MASTER_PRODUCT_IMAGE_PATH;
        else process.env.MASTER_PRODUCT_IMAGE_PATH = previous;
    }
});

// ── 4c. The bundled master asset resolves to a stable module-relative path ─
test('the master image resolves to the bundled asset when no override is set', () => {
    const previous = process.env.MASTER_PRODUCT_IMAGE_PATH;
    delete process.env.MASTER_PRODUCT_IMAGE_PATH;
    try {
        assert.equal(resolveMasterImagePath(), DEFAULT_MASTER_IMAGE_PATH);
        assert.ok(DEFAULT_MASTER_IMAGE_PATH.replace(/\\/g, '/').includes('src/assets/ms-fragrance-master.png'));
    } finally {
        if (previous !== undefined) process.env.MASTER_PRODUCT_IMAGE_PATH = previous;
    }
});

// ── 4d. An absolute MASTER_PRODUCT_IMAGE_PATH override is honored ────────
test('resolveMasterImagePath honors an absolute env override', () => {
    const previous = process.env.MASTER_PRODUCT_IMAGE_PATH;
    process.env.MASTER_PRODUCT_IMAGE_PATH = '/opt/assets/master.png';
    try {
        assert.equal(resolveMasterImagePath(), '/opt/assets/master.png');
    } finally {
        if (previous === undefined) delete process.env.MASTER_PRODUCT_IMAGE_PATH;
        else process.env.MASTER_PRODUCT_IMAGE_PATH = previous;
    }
});


// ── 5. Response format stays compatible with res.json({ image }) ─────────
test('generateProductImage returns the b64 string the controller serializes as { image }', async () => {
    const client = fakeOpenAi({ editResult: { data: [{ b64_json: 'QUJD' }] } });
    const master = fakeLoadMasterImage();
    const service = new ProductAiService({ client, loadMasterImage: master.load });

    const image = await service.generateProductImage({ name: 'Musk Noir' });
    assert.equal(typeof image, 'string');
    assert.equal(image, 'QUJD');
});

// ── 6. Input validation: a name is required before generation ────────────
test('generateProductImage rejects an empty product name without calling the API', async () => {
    const client = fakeOpenAi();
    const master = fakeLoadMasterImage();
    const service = new ProductAiService({ client, loadMasterImage: master.load });

    await assert.rejects(
        () => service.generateProductImage({ name: '   ' }),
        (error) => {
            assert.equal(error.statusCode, 400);
            assert.equal(error.code, 'PRODUCT_NAME_REQUIRED');
            return true;
        }
    );
    assert.equal(client.calls.edit.length, 0);
    assert.equal(master.state.called, 0);
});

// ── 7. generateProductData() behaviour is unchanged ──────────────────────
test('generateProductData is unchanged and still returns parsed JSON', async () => {
    const parsed = { name: 'Oud Royale', description: 'Rich', fullDescription: 'x', brand: '', category: '', fragranceFamily: 'Woody', fragranceType: 'Attar', topNotes: 'a', heartNotes: 'b', baseNotes: 'c' };
    let seen;
    const client = {
        responses: {
            async create(params) {
                seen = params;
                return { output_text: JSON.stringify(parsed) };
            },
        },
    };
    const service = new ProductAiService({ client });

    const result = await service.generateProductData('Oud Royale');
    assert.deepEqual(result, parsed);
    // Still uses the responses API with a json_schema text format.
    assert.equal(seen.model, 'gpt-5.5');
    assert.equal(seen.text.format.type, 'json_schema');
});

// ── 8. Route wiring: authenticate + requireAdmin still guard /ai-image ───
test('the /ai-image route keeps authenticate and requireAdmin', () => {
    const routesSource = readFileSync(
        fileURLToPath(new URL('../../../src/modules/products/product.routes.js', import.meta.url)),
        'utf8'
    );
    const block = routesSource.match(/\/ai-image[\s\S]*?\);/);
    assert.ok(block, 'the /ai-image route must exist');
    assert.ok(block[0].includes('authenticate'));
    assert.ok(block[0].includes('requireAdmin'));
});

// ── 9. Service uses reference input (images.edit), not text-only generate ─
test('the service uses images.edit (reference input) rather than images.generate', () => {
    const source = readFileSync(
        fileURLToPath(new URL('../../../src/shared/ai/product-ai.service.js', import.meta.url)),
        'utf8'
    );
    assert.ok(source.includes('images.edit'), 'product images must use the images.edit reference API');
    assert.ok(/image:\s*\[/.test(source), 'the reference image must be passed as the image input');
});

