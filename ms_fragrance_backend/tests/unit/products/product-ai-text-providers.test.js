import test from 'node:test';
import assert from 'node:assert/strict';

import ProductAiService from '../../../src/shared/ai/product-ai.service.js';
import CloudflareTextAdapter from '../../../src/shared/ai/cloudflare.text.adapter.js';
import {
    createProductTextAdapter,
    resolveTextProvider,
    DEFAULT_CLOUDFLARE_TEXT_MODEL,
} from '../../../src/shared/ai/text-provider.js';

// ── Fakes ────────────────────────────────────────────────────────────────
// No network, no paid API calls: fetch stand-in records calls and replays
// queued responses/errors.
function fakeFetch(responses = []) {
    const queue = [...responses];
    const calls = [];
    const fetchImpl = async (url, options) => {
        calls.push({ url, options });
        const next = queue.shift();
        if (next instanceof Error) throw next;
        return next || cloudflareTextResponse(JSON.stringify({ name: 'X' }));
    };
    return { calls, fetchImpl };
}

function cloudflareTextResponse(text, { status = 200, success = true } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => 'application/json' },
        async json() {
            return { result: { response: text }, success, errors: [], messages: [] };
        },
    };
}

function jsonResponse(body, { status = 200 } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => 'application/json' },
        async json() {
            if (body instanceof Error) throw body;
            return body;
        },
    };
}

function fakeOpenAiClient(productJson) {
    const calls = { create: [] };
    return {
        calls,
        responses: {
            async create(params) {
                calls.create.push(params);
                return { output_text: productJson };
            },
        },
    };
}

// ── 1. Provider selection ────────────────────────────────────────────
test('the default text provider is openai and requires no adapter', () => {
    assert.equal(resolveTextProvider({}), 'openai');
    assert.equal(createProductTextAdapter({ env: {} }), null);
});

test('PRODUCT_TEXT_PROVIDER=cloudflare selects the Cloudflare text adapter with the documented model', () => {
    const env = {
        PRODUCT_TEXT_PROVIDER: 'cloudflare',
        CLOUDFLARE_ACCOUNT_ID: 'acct-123',
        CLOUDFLARE_API_TOKEN: 'token-abc',
    };
    assert.equal(resolveTextProvider(env), 'cloudflare');

    const adapter = createProductTextAdapter({ env });
    assert.ok(adapter instanceof CloudflareTextAdapter);
    assert.equal(adapter.model, DEFAULT_CLOUDFLARE_TEXT_MODEL);
    assert.equal(DEFAULT_CLOUDFLARE_TEXT_MODEL, '@cf/meta/llama-3.1-8b-instruct');
});

test('text provider selection is case-insensitive and CLOUDFLARE_TEXT_MODEL overrides the default', () => {
    assert.equal(resolveTextProvider({ PRODUCT_TEXT_PROVIDER: ' CloudFlare ' }), 'cloudflare');

    const adapter = createProductTextAdapter({
        env: {
            PRODUCT_TEXT_PROVIDER: 'CLOUDFLARE',
            CLOUDFLARE_ACCOUNT_ID: 'a',
            CLOUDFLARE_API_TOKEN: 't',
            CLOUDFLARE_TEXT_MODEL: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        },
    });
    assert.equal(adapter.model, '@cf/meta/llama-3.3-70b-instruct-fp8-fast');
});

test('unsupported text provider names are rejected', () => {
    for (const name of ['edenai', 'google']) {
        assert.throws(
            () => createProductTextAdapter({ env: { PRODUCT_TEXT_PROVIDER: name } }),
            (error) => {
                assert.equal(error.code, 'UNSUPPORTED_TEXT_PROVIDER');
                return true;
            }
        );
    }
    assert.equal(resolveTextProvider({ PRODUCT_TEXT_PROVIDER: '   ' }), 'openai');
});

// ── 2. Adapter request shape (mocked) ────────────────────────────────
test('the Cloudflare text adapter posts messages + JSON schema with a Bearer token and reads result.response', async () => {
    const productJson = JSON.stringify({ name: 'Royal Oud', description: 'd' });
    const { calls, fetchImpl } = fakeFetch([cloudflareTextResponse(productJson)]);
    const adapter = new CloudflareTextAdapter({
        accountId: 'acct-123',
        apiToken: 'token-abc',
        model: '@cf/meta/llama-3.1-8b-instruct',
        fetchImpl,
    });

    const text = await adapter.generateProductJson({
        instructions: 'SYSTEM PROMPT',
        input: 'USER PROMPT',
        schema: { type: 'object' },
    });

    assert.equal(text, productJson);
    assert.equal(calls.length, 1);
    assert.equal(
        calls[0].url,
        'https://api.cloudflare.com/client/v4/accounts/acct-123/ai/run/@cf/meta/llama-3.1-8b-instruct'
    );
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer token-abc');
    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.messages[0].role, 'system');
    assert.equal(body.messages[0].content, 'SYSTEM PROMPT');
    assert.equal(body.messages[1].role, 'user');
    assert.equal(body.response_format.type, 'json_schema');
});

// ── 3. Adapter failure modes (mocked) ────────────────────────────────
test('missing Cloudflare text credentials fail closed with 503', async () => {
    const adapter = new CloudflareTextAdapter({ accountId: '', apiToken: '', model: 'm', fetchImpl: fakeFetch().fetchImpl });
    await assert.rejects(() => adapter.generateProductJson({ instructions: 'i', input: 'u', schema: {} }),
        (error) => error.code === 'CLOUDFLARE_TEXT_NOT_CONFIGURED' && error.statusCode === 503);
});

test('HTTP errors, rate limits, timeouts and malformed payloads map to safe errors', async () => {
    const base = { accountId: 'a', apiToken: 't', model: 'm' };

    const http500 = new CloudflareTextAdapter({ ...base, fetchImpl: fakeFetch([jsonResponse({}, { status: 500 })]).fetchImpl });
    await assert.rejects(() => http500.generateProductJson({}),
        (error) => error.code === 'CLOUDFLARE_TEXT_REQUEST_FAILED');

    const limited = new CloudflareTextAdapter({ ...base, fetchImpl: fakeFetch([jsonResponse({}, { status: 429 })]).fetchImpl });
    await assert.rejects(() => limited.generateProductJson({}),
        (error) => error.code === 'CLOUDFLARE_TEXT_RATE_LIMITED' && error.statusCode === 429);

    const timeout = new CloudflareTextAdapter({
        ...base,
        fetchImpl: async () => { const error = new Error('aborted'); error.name = 'AbortError'; throw error; },
    });
    await assert.rejects(() => timeout.generateProductJson({}),
        (error) => error.code === 'CLOUDFLARE_TEXT_TIMEOUT' && error.statusCode === 504);

    const malformed = new CloudflareTextAdapter({
        ...base,
        fetchImpl: fakeFetch([jsonResponse({ result: {}, success: false })]).fetchImpl,
    });
    await assert.rejects(() => malformed.generateProductJson({}),
        (error) => error.code === 'CLOUDFLARE_TEXT_INVALID_RESPONSE');
});

test('provider errors never leak the API token', async () => {
    const adapter = new CloudflareTextAdapter({
        accountId: 'a', apiToken: 'super-secret-token', model: 'm',
        fetchImpl: fakeFetch([jsonResponse({}, { status: 500 })]).fetchImpl,
    });
    const error = await adapter.generateProductJson({}).catch((e) => e);
    assert.ok(!String(error.message).includes('super-secret-token'));
});

// ── 4. Service flow: OpenAI default vs Cloudflare adapter ──────────
const fullProduct = {
    name: 'Royal Oud Intense',
    description: 'A deep woody oud attar',
    fullDescription: 'Full description here',
    brand: '',
    category: '',
    fragranceFamily: '',
    fragranceType: 'attar',
    topNotes: 'Saffron',
    heartNotes: 'Rose',
    baseNotes: 'Amber',
};

test('the OpenAI default path still uses gpt-5.5 with the unchanged contract', async () => {
    const client = fakeOpenAiClient(JSON.stringify(fullProduct));
    const service = new ProductAiService({ client });

    const result = await service.generateProductData('Royal Oud Intense');

    assert.deepEqual(result, fullProduct);
    assert.equal(client.calls.create.length, 1);
    assert.equal(client.calls.create[0].model, 'gpt-5.5');
});

test('missing product names are rejected before any provider call', async () => {
    const client = fakeOpenAiClient(JSON.stringify(fullProduct));
    const service = new ProductAiService({ client });
    await assert.rejects(() => service.generateProductData('   '),
        (error) => error.code === 'PRODUCT_NAME_REQUIRED' && error.statusCode === 400);
    assert.equal(client.calls.create.length, 0);
});

test('the Cloudflare adapter reuses the shared prompt and existing validation', async () => {
    const { calls, fetchImpl } = fakeFetch([cloudflareTextResponse(JSON.stringify(fullProduct))]);
    const textAdapter = new CloudflareTextAdapter({
        accountId: 'a', apiToken: 't', model: '@cf/meta/llama-3.1-8b-instruct', fetchImpl,
    });
    const blockingClient = { responses: { create: async () => { throw new Error('OpenAI must not be called'); } } };
    const service = new ProductAiService({ client: blockingClient, textAdapter });

    const result = await service.generateProductData('Royal Oud Intense');

    assert.deepEqual(result, fullProduct);
    const body = JSON.parse(calls[0].options.body);
    assert.ok(body.messages[0].content.includes('expert perfume and attar ecommerce content assistant'));
    assert.ok(body.messages[1].content.includes('Royal Oud Intense'));
    assert.deepEqual(body.response_format.json_schema.required, [
        'name', 'description', 'fullDescription', 'brand', 'category',
        'fragranceFamily', 'fragranceType', 'topNotes', 'heartNotes', 'baseNotes',
    ]);
});

test('invalid Cloudflare text output surfaces INVALID_RESPONSE without touching the database', async () => {
    const { fetchImpl } = fakeFetch([cloudflareTextResponse('not json at all {{{')]);
    const service = new ProductAiService({
        client: { responses: { create: async () => { throw new Error('must not be called'); } } },
        textAdapter: new CloudflareTextAdapter({ accountId: 'a', apiToken: 't', model: 'm', fetchImpl }),
    });
    await assert.rejects(() => service.generateProductData('Royal Oud'),
        (error) => error.code === 'AI_INVALID_PRODUCT_JSON');
});

test('Cloudflare response without result.response surfaces CLOUDFLARE_TEXT_INVALID_RESPONSE', async () => {
    const { fetchImpl } = fakeFetch([jsonResponse({ result: {}, success: true, errors: [], messages: [] })]);
    const service = new ProductAiService({
        client: { responses: { create: async () => { throw new Error('must not be called'); } } },
        textAdapter: new CloudflareTextAdapter({ accountId: 'a', apiToken: 't', model: 'm', fetchImpl }),
    });
    await assert.rejects(() => service.generateProductData('Royal Oud'),
        (error) => error.code === 'CLOUDFLARE_TEXT_INVALID_RESPONSE');
});

test('Cloudflare response with null result.response surfaces CLOUDFLARE_TEXT_INVALID_RESPONSE', async () => {
    const { fetchImpl } = fakeFetch([jsonResponse({ result: { response: null }, success: true, errors: [], messages: [] })]);
    const service = new ProductAiService({
        client: { responses: { create: async () => { throw new Error('must not be called'); } } },
        textAdapter: new CloudflareTextAdapter({ accountId: 'a', apiToken: 't', model: 'm', fetchImpl }),
    });
    await assert.rejects(() => service.generateProductData('Royal Oud'),
        (error) => error.code === 'CLOUDFLARE_TEXT_INVALID_RESPONSE');
});

test('Cloudflare response body with success:false surfaces CLOUDFLARE_TEXT_INVALID_RESPONSE even over HTTP 200', async () => {
    const { fetchImpl } = fakeFetch([jsonResponse({ result: null, success: false, errors: [{ code: 'model_error' }], messages: [] })]);
    const service = new ProductAiService({
        client: { responses: { create: async () => { throw new Error('must not be called'); } } },
        textAdapter: new CloudflareTextAdapter({ accountId: 'a', apiToken: 't', model: 'm', fetchImpl }),
    });
    await assert.rejects(() => service.generateProductData('Royal Oud'),
        (error) => error.code === 'CLOUDFLARE_TEXT_INVALID_RESPONSE');
});

test('Cloudflare markdown-fenced JSON is stripped and parsed by the service', async () => {
    const fenced = '```json\n' + JSON.stringify(fullProduct) + '\n```';
    const { fetchImpl } = fakeFetch([cloudflareTextResponse(fenced)]);
    const service = new ProductAiService({
        client: { responses: { create: async () => { throw new Error('must not be called'); } } },
        textAdapter: new CloudflareTextAdapter({ accountId: 'a', apiToken: 't', model: 'm', fetchImpl }),
    });
    const result = await service.generateProductData('Royal Oud');
    assert.deepEqual(result, fullProduct);
});

test('Cloudflare markdown-fenced invalid JSON still surfaces AI_INVALID_PRODUCT_JSON', async () => {
    const fenced = '```json\nnot json at all {{{```';
    const { fetchImpl } = fakeFetch([cloudflareTextResponse(fenced)]);
    const service = new ProductAiService({
        client: { responses: { create: async () => { throw new Error('must not be called'); } } },
        textAdapter: new CloudflareTextAdapter({ accountId: 'a', apiToken: 't', model: 'm', fetchImpl }),
    });
    await assert.rejects(() => service.generateProductData('Royal Oud'),
        (error) => error.code === 'AI_INVALID_PRODUCT_JSON');
});
