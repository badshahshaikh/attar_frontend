import test from 'node:test';
import assert from 'node:assert/strict';

import ProductAiService from '../../../src/shared/ai/product-ai.service.js';
import CloudflareImageAdapter, {
    CLOUDFLARE_API_BASE,
    DEFAULT_CLOUDFLARE_IMAGE_MODEL,
} from '../../../src/shared/ai/cloudflare.image.adapter.js';
import {
    createProductImageAdapter,
    resolveImageProvider,
    SUPPORTED_IMAGE_PROVIDERS,
    DEFAULT_IMAGE_PROVIDER,
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
        return next || cloudflareJsonResponse({ result: { image: 'R0lGODlhAQABAAAAACw=' } });
    };
    return { calls, fetchImpl };
}

// Cloudflare REST envelope: { result: { image }, success, errors, messages }.
function cloudflareJsonResponse(resultBody, { status = 200 } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null) },
        async json() {
            if (resultBody instanceof Error) throw resultBody;
            return { result: resultBody.result, success: true, errors: [], messages: [] };
        },
    };
}

function cloudflareBinaryResponse(bytes, { status = 200 } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'image/png' : null) },
        async arrayBuffer() {
            return Buffer.from(bytes).buffer.slice(0, bytes.length);
        },
    };
}

function httpErrorResponse(status) {
    return {
        ok: false,
        status,
        headers: { get: () => 'application/json' },
        async json() {
            return { success: false, errors: [{ code: status }], messages: [] };
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

const CLOUDFLARE_ENV = {
    PRODUCT_IMAGE_PROVIDER: 'cloudflare',
    CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
    CLOUDFLARE_API_TOKEN: 'test-api-token',
};

const EXPECTED_URL =
    `${CLOUDFLARE_API_BASE}/accounts/test-account-id/ai/run/${DEFAULT_CLOUDFLARE_IMAGE_MODEL}`;

// ── 1. Provider selection ────────────────────────────────────────────────
test('the default provider is still openai (Cloudflare is opt-in)', () => {
    assert.equal(resolveImageProvider({}), 'openai');
    assert.equal(DEFAULT_IMAGE_PROVIDER, 'openai');
    assert.ok(SUPPORTED_IMAGE_PROVIDERS.includes('openai'));
    assert.ok(SUPPORTED_IMAGE_PROVIDERS.includes('edenai'));
    assert.ok(SUPPORTED_IMAGE_PROVIDERS.includes('cloudflare'));
});

test('PRODUCT_IMAGE_PROVIDER=cloudflare selects the adapter with the flux-1-schnell model', () => {
    assert.equal(resolveImageProvider(CLOUDFLARE_ENV), 'cloudflare');
    assert.equal(DEFAULT_CLOUDFLARE_IMAGE_MODEL, '@cf/black-forest-labs/flux-1-schnell');

    const adapter = createProductImageAdapter({ env: CLOUDFLARE_ENV });
    assert.ok(adapter instanceof CloudflareImageAdapter);
    assert.equal(adapter.model, DEFAULT_CLOUDFLARE_IMAGE_MODEL);
    assert.equal(adapter.supportsReferenceImage, false);
});

test('provider selection is case-insensitive and CLOUDFLARE_IMAGE_MODEL overrides the default', () => {
    assert.equal(resolveImageProvider({ PRODUCT_IMAGE_PROVIDER: ' CloudFlare ' }), 'cloudflare');

    const adapter = createProductImageAdapter({
        env: { ...CLOUDFLARE_ENV, PRODUCT_IMAGE_PROVIDER: 'CLOUDFLARE', CLOUDFLARE_IMAGE_MODEL: '@cf/stabilityai/stable-diffusion-xl-base-1.0' },
    });
    assert.equal(adapter.model, '@cf/stabilityai/stable-diffusion-xl-base-1.0');
    assert.equal(
        adapter.buildUrl(),
        `${CLOUDFLARE_API_BASE}/accounts/test-account-id/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`
    );
});

test('unknown provider names are still rejected', () => {
    assert.throws(
        () => resolveImageProvider({ PRODUCT_IMAGE_PROVIDER: 'midjourney' }),
        (error) => {
            assert.equal(error.statusCode, 500);
            assert.equal(error.code, 'UNSUPPORTED_IMAGE_PROVIDER');
            return true;
        }
    );
});
