import test from 'node:test';
import assert from 'node:assert/strict';

import ProductAiService from '../../../src/shared/ai/product-ai.service.js';
import EdenAiImageAdapter, { EDEN_AI_IMAGE_EDITS_URL } from '../../../src/shared/ai/edenai.image.adapter.js';
import {
    createProductImageAdapter,
    resolveImageProvider,
    DEFAULT_EDENAI_IMAGE_MODEL,
} from '../../../src/shared/ai/image-provider.js';

// ── Fakes ────────────────────────────────────────────────────────────────
// fetch stand-in that records calls and replays queued responses/errors.
// No network, no paid API calls.
function fakeFetch(responses = []) {
    const queue = [...responses];
    const calls = [];
    const fetchImpl = async (url, options) => {
        calls.push({ url, options });
        const next = queue.shift();
        if (next instanceof Error) throw next;
        return next || jsonResponse({ data: [{ b64_json: 'R0lGODlhAQABAAAAACw=' }] });
    };
    return { calls, fetchImpl };
}

function jsonResponse(body, { status = 200 } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json() {
            if (body instanceof Error) throw body;
            return body;
        },
    };
}

function fakeOpenAiClient() {
    const calls = { edit: [], create: [] };
    return {
        calls,
        images: {
            async edit(params) {
                calls.edit.push(params);
                return { data: [{ b64_json: 'R0lGODlhAQABAAAAACw=' }] };
            },
        },
        responses: {
            async create(params) {
                calls.create.push(params);
                return { output_text: '{"name":"X"}' };
            },
        },
    };
}

function fakeLoadMasterImage() {
    return async () => ({
        file: { name: 'ms-fragrance-master.png', type: 'image/png', __master: true },
        buffer: Buffer.from([1, 2, 3]),
    });
}

const product = {
    name: 'Royal Oud Intense',
    description: 'A deep woody oud attar',
    fragranceFamily: 'Woody',
    topNotes: 'Saffron, bergamot',
    heartNotes: 'Rose, oud',
    baseNotes: 'Amber, sandalwood',
};

// ── 1. Provider selection ────────────────────────────────────────────────
test('the default provider is openai and requires no adapter', () => {
    assert.equal(resolveImageProvider({}), 'openai');
    assert.equal(createProductImageAdapter({ env: {} }), null);
});

test('PRODUCT_IMAGE_PROVIDER=edenai selects the Eden AI adapter with the documented model', () => {
    const env = { PRODUCT_IMAGE_PROVIDER: 'edenai', EDEN_AI_API_KEY: 'secret-key' };
    assert.equal(resolveImageProvider(env), 'edenai');

    const adapter = createProductImageAdapter({ env });
    assert.ok(adapter instanceof EdenAiImageAdapter);
    assert.equal(adapter.model, DEFAULT_EDENAI_IMAGE_MODEL, 'defaults to the gpt-image-2 model via Eden AI');
    assert.equal(DEFAULT_EDENAI_IMAGE_MODEL, 'openai/gpt-image-2');
});

test('provider selection is case-insensitive and trimmed, and EDEN_AI_IMAGE_MODEL overrides the default', () => {
    assert.equal(resolveImageProvider({ PRODUCT_IMAGE_PROVIDER: ' EdenAI ' }), 'edenai');

    const adapter = createProductImageAdapter({
        env: { PRODUCT_IMAGE_PROVIDER: 'EDENAI', EDEN_AI_API_KEY: 'k', EDEN_AI_IMAGE_MODEL: 'stabilityai/stable-diffusion-xl-1024-v1-0' },
    });
    assert.equal(adapter.model, 'stabilityai/stable-diffusion-xl-1024-v1-0');
});

test('unsupported provider names are rejected', () => {
    for (const name of ['google', 'midjourney']) {
        assert.throws(
            () => createProductImageAdapter({ env: { PRODUCT_IMAGE_PROVIDER: name } }),
            (error) => {
                assert.equal(error.code, 'UNSUPPORTED_IMAGE_PROVIDER');
                assert.equal(error.statusCode, 500);
                return true;
            }
        );
    }
    // Blank configuration falls back to the openai default.
    assert.equal(resolveImageProvider({ PRODUCT_IMAGE_PROVIDER: '   ' }), 'openai');
});

// ── 2. Eden AI request shape (documented /v3/images/edits contract) ──────
test('the Eden adapter posts to the documented edits endpoint with the master image as a base64 data URL', async () => {
    const { calls, fetchImpl } = fakeFetch([
        jsonResponse({ cost: 0.05, provider: 'openai', data: [{ b64_json: 'QUJD' }] }),
    ]);
    const adapter = new EdenAiImageAdapter({ apiKey: 'secret-key', model: 'openai/gpt-image-2', fetchImpl });

    const b64 = await adapter.generatePng({ prompt: 'test prompt', imageBuffer: Buffer.from([1, 2, 3]) });

    assert.equal(b64, 'QUJD', 'normalized to the raw base64 PNG string');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, EDEN_AI_IMAGE_EDITS_URL);
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer secret-key');

    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.model, 'openai/gpt-image-2');
    assert.equal(body.prompt, 'test prompt');
    assert.equal(body.n, 1);
    assert.equal(body.size, '1024x1024');
    assert.deepEqual(body.images, [
        { image_url: `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}` },
    ]);
});

// ── 3. Full service flow with the Eden adapter ───────────────────────────
test('generateProductImage flows through the Eden adapter with the shared prompt and master image', async () => {
    const { calls, fetchImpl } = fakeFetch();
    const adapter = new EdenAiImageAdapter({ apiKey: 'secret-key', model: 'openai/gpt-image-2', fetchImpl });
    const client = fakeOpenAiClient();
    const service = new ProductAiService({ client, loadMasterImage: fakeLoadMasterImage(), imageAdapter: adapter });

    const image = await service.generateProductImage(product);

    assert.equal(image, 'R0lGODlhAQABAAAAACw=');
    assert.equal(calls.length, 1);
    assert.equal(client.calls.edit.length, 0, 'the OpenAI path must not be used when Eden AI is selected');

    const body = JSON.parse(calls[0].options.body);
    // The shared prompt construction is preserved.
    assert.ok(body.prompt.includes('Royal Oud Intense'));
    assert.ok(body.prompt.includes('Saffron, bergamot'));
    assert.ok(body.prompt.includes('MS FRAGRANCE'));
    // The master bottle reference is sent with the request.
    assert.equal(body.images[0].image_url.startsWith('data:image/png;base64,'), true);
});

test('the Eden flow keeps the product-name validation before any provider call', async () => {
    const { calls, fetchImpl } = fakeFetch();
    const adapter = new EdenAiImageAdapter({ apiKey: 'secret-key', fetchImpl });
    const service = new ProductAiService({ client: fakeOpenAiClient(), loadMasterImage: fakeLoadMasterImage(), imageAdapter: adapter });

    await assert.rejects(
        () => service.generateProductImage({ name: '   ' }),
        (error) => {
            assert.equal(error.statusCode, 400);
            assert.equal(error.code, 'PRODUCT_NAME_REQUIRED');
            return true;
        }
    );
    assert.equal(calls.length, 0, 'no provider call must happen for invalid input');
});

test('the OpenAI default path is unchanged when no adapter is injected', async () => {
    const client = fakeOpenAiClient();
    const service = new ProductAiService({ client, loadMasterImage: fakeLoadMasterImage() });

    const image = await service.generateProductImage(product);

    assert.equal(image, 'R0lGODlhAQABAAAAACw=');
    assert.equal(client.calls.edit.length, 1);
    assert.equal(client.calls.edit[0].model, 'gpt-image-2');
    assert.equal(client.calls.edit[0].image[0].__master, true);
});

// ── 4. Missing configuration, provider failures and malformed responses ──
test('missing EDEN_AI_API_KEY fails fast with 503 and never calls the provider', async () => {
    const { calls, fetchImpl } = fakeFetch();
    const adapter = new EdenAiImageAdapter({ apiKey: undefined, fetchImpl });
    const service = new ProductAiService({ client: fakeOpenAiClient(), loadMasterImage: fakeLoadMasterImage(), imageAdapter: adapter });

    await assert.rejects(
        () => service.generateProductImage(product),
        (error) => {
            assert.equal(error.statusCode, 503);
            assert.equal(error.code, 'EDEN_AI_NOT_CONFIGURED');
            return true;
        }
    );
    assert.equal(calls.length, 0);
});

test('a missing master image buffer fails with 503 and never calls the provider', async () => {
    const { calls, fetchImpl } = fakeFetch();
    const adapter = new EdenAiImageAdapter({ apiKey: 'secret-key', fetchImpl });
    const service = new ProductAiService({
        client: fakeOpenAiClient(),
        loadMasterImage: async () => ({ file: null, buffer: Buffer.alloc(0) }),
        imageAdapter: adapter,
    });

    await assert.rejects(
        () => service.generateProductImage(product),
        (error) => {
            assert.equal(error.statusCode, 503);
            assert.equal(error.code, 'MASTER_IMAGE_INVALID');
            return true;
        }
    );
    assert.equal(calls.length, 0);
});

test('provider HTTP errors are sanitized and never leak the key or response body', async () => {
    const { calls, fetchImpl } = fakeFetch([
        jsonResponse({ error: 'Internal provider boom with details secret-key' }, { status: 500 }),
    ]);
    const adapter = new EdenAiImageAdapter({ apiKey: 'secret-key', fetchImpl });

    await assert.rejects(
        () => adapter.generatePng({ prompt: 'p', imageBuffer: Buffer.from([1]) }),
        (error) => {
            assert.equal(error.statusCode, 502);
            assert.equal(error.code, 'EDEN_AI_REQUEST_FAILED');
            assert.ok(!error.message.includes('secret-key'), 'the API key must not leak');
            assert.ok(!error.message.includes('provider boom'), 'provider bodies must not leak');
            return true;
        }
    );
    assert.equal(calls.length, 1);
});

test('timeouts are mapped to a safe 504 error', async () => {
    const abortError = Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' });
    const { fetchImpl } = fakeFetch([abortError]);
    const adapter = new EdenAiImageAdapter({ apiKey: 'secret-key', fetchImpl });

    await assert.rejects(
        () => adapter.generatePng({ prompt: 'p', imageBuffer: Buffer.from([1]) }),
        (error) => {
            assert.equal(error.statusCode, 504);
            assert.equal(error.code, 'EDEN_AI_TIMEOUT');
            return true;
        }
    );
});

test('network failures are mapped to a safe 502 error without internal details', async () => {
    const { fetchImpl } = fakeFetch([new Error('connect ECONNREFUSED 127.0.0.1:443')]);
    const adapter = new EdenAiImageAdapter({ apiKey: 'secret-key', fetchImpl });

    await assert.rejects(
        () => adapter.generatePng({ prompt: 'p', imageBuffer: Buffer.from([1]) }),
        (error) => {
            assert.equal(error.statusCode, 502);
            assert.equal(error.code, 'EDEN_AI_REQUEST_FAILED');
            assert.ok(!error.message.includes('ECONNREFUSED'), 'internal network details must not leak');
            return true;
        }
    );
});

test('malformed or image-less provider responses are rejected with 502', async () => {
    for (const payload of [
        {},                                   // no data array
        { data: [] },                         // empty data
        { data: [{ url: 'https://x/img.png' }] }, // no b64_json
        { status: 'fail', data: [] },         // provider failure (e.g. model without reference support)
    ]) {
        const { fetchImpl } = fakeFetch([jsonResponse(payload)]);
        const adapter = new EdenAiImageAdapter({ apiKey: 'secret-key', fetchImpl });

        await assert.rejects(
            () => adapter.generatePng({ prompt: 'p', imageBuffer: Buffer.from([1]) }),
            (error) => {
                assert.equal(error.statusCode, 502);
                assert.equal(error.code, 'EDEN_AI_INVALID_RESPONSE');
                return true;
            },
            `payload ${JSON.stringify(payload)} must be rejected`
        );
    }

    // Unparsable JSON body.
    const { fetchImpl } = fakeFetch([jsonResponse(new Error('Unexpected token < in JSON'))]);
    const badJson = new EdenAiImageAdapter({ apiKey: 'secret-key', fetchImpl });
    await assert.rejects(
        () => badJson.generatePng({ prompt: 'p', imageBuffer: Buffer.from([1]) }),
        (error) => error.code === 'EDEN_AI_INVALID_RESPONSE'
    );
});

// ── 5. Separation of concerns ────────────────────────────────────────────
test('generateProductData still uses the OpenAI responses API even with an Eden image adapter', async () => {
    const { calls, fetchImpl } = fakeFetch();
    const adapter = new EdenAiImageAdapter({ apiKey: 'secret-key', fetchImpl });
    const client = fakeOpenAiClient();
    const service = new ProductAiService({ client, loadMasterImage: fakeLoadMasterImage(), imageAdapter: adapter });

    await service.generateProductData('Oud Royale');

    assert.equal(client.calls.create.length, 1, 'product data stays on the OpenAI client');
    assert.equal(client.calls.create[0].model, 'gpt-5.5');
    assert.equal(calls.length, 0, 'Eden AI is never used for product data');
});