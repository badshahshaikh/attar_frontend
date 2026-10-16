import test from 'node:test';
import assert from 'node:assert/strict';

import ProductAiService from '../../../src/shared/ai/product-ai.service.js';
import SiliconFlowImageAdapter, {
    SILICONFLOW_API_BASE,
    DEFAULT_SILICONFLOW_IMAGE_MODEL,
    DEFAULT_TIMEOUT_MS
} from '../../../src/shared/ai/siliconflow.image.adapter.js';

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
        return next || defaultResponse();
    };
    return { calls, fetchImpl };
}

function defaultResponse() {
    return jsonResponse({ images: [{ url: 'https://api.siliconflow.com/v1/images/generations/result/ok.png' }] });
}

function jsonResponse(body, { status = 200 } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null) },
        async json() {
            if (body instanceof Error) throw body;
            return body;
        }
    };
}

function imageResponse(bytes, { status = 200, contentType = 'image/png' } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? contentType : null) },
        async arrayBuffer() {
            // Slice at byteOffset so pooled Buffer backing arrays are handled
            // correctly (Buffer.from([...]) may share a larger internal pool).
            return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        }
    };
}

function fakeOpenAiClient() {
    const calls = { edit: [], create: [] };
    return {
        calls,
        images: {
            async edit() {
                return { data: [{ b64_json: 'R0lGODlhAQABAAAAACw=' }] };
            }
        },
        responses: {
            async create() {
                return { output_text: '{}' };
            }
        }
    };
}

function fakeLoadMasterImage() {
    return async () => ({
        file: { name: 'ms-fragrance-master.png', type: 'image/png', __master: true },
        buffer: IMAGE_BUFFER
    });
}

const API_KEY = 'sk-test-siliconflow-1234567890abcdef';
const PROMPT =
    'Premium product photography of a frosted glass attar bottle, MS FRAGRANCE Royal Oud Intense, amber liquid, luxury studio lighting';
const IMAGE_BUFFER = Buffer.from([137, 80, 78, 71, 1, 2, 3]);
const IMAGE_DATA_URL = `data:image/png;base64,${IMAGE_BUFFER.toString('base64')}`;
const GENERATED_BYTES = Buffer.from([89, 50, 41]);
const GENERATED_B64 = GENERATED_BYTES.toString('base64');
const IMAGE_URL = 'https://api.siliconflow.com/v1/images/generations/result/ok.png';

const product = {
    name: 'Royal Oud Intense',
    description: 'A deep woody oud attar',
    fragranceFamily: 'Woody',
    topNotes: 'Saffron, bergamot',
    heartNotes: 'Rose, oud',
    baseNotes: 'Amber, sandalwood'
};

// ── 1. Configuration ───────────────────────────────────────────────────
test('defaults to the documented FLUX.2-flex model and reports reference-image support', () => {
    const adapter = new SiliconFlowImageAdapter({ apiKey: API_KEY });
    assert.equal(adapter.model, DEFAULT_SILICONFLOW_IMAGE_MODEL);
    assert.equal(DEFAULT_SILICONFLOW_IMAGE_MODEL, 'black-forest-labs/FLUX.2-flex');
    assert.equal(adapter.supportsReferenceImage, true);
});

test('constructor overrides the model and timeout', () => {
    const adapter = new SiliconFlowImageAdapter({
        apiKey: API_KEY,
        model: 'black-forest-labs/FLUX.2-pro',
        timeoutMs: 120000
    });
    assert.equal(adapter.model, 'black-forest-labs/FLUX.2-pro');
    assert.equal(DEFAULT_TIMEOUT_MS, 60000);
});

// ── 2. Success ─────────────────────────────────────────────────────────
test('returns the base64 image and downloads the URL returned by SiliconFlow', async () => {
    const { calls, fetchImpl } = fakeFetch([
        jsonResponse({ images: [{ url: IMAGE_URL }] }),
        imageResponse(GENERATED_BYTES)
    ]);
    const adapter = new SiliconFlowImageAdapter({ apiKey: API_KEY, fetchImpl });

    const b64 = await adapter.generatePng({ prompt: PROMPT, imageBuffer: IMAGE_BUFFER });

    assert.equal(b64, GENERATED_B64);
    assert.equal(calls.length, 2, 'one generation request plus one image download');

    assert.equal(calls[0].url, SILICONFLOW_API_BASE);
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers.Authorization, `Bearer ${API_KEY}`);
    assert.equal(calls[0].options.headers['Content-Type'], 'application/json');

    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.model, DEFAULT_SILICONFLOW_IMAGE_MODEL);
    assert.equal(body.prompt, PROMPT);
    assert.equal(body.image, IMAGE_DATA_URL, 'reference image sent as base64 data URL');
    assert.equal(body.image_size, '1024x1024');
    assert.equal(body.output_format, 'png');
    assert.equal(body.num_inference_steps, 25);

    assert.equal(calls[1].url, IMAGE_URL);
    assert.equal(calls[1].options.method, 'GET');
});

test('reads the master reference image from imageFile when imageBuffer is absent', async () => {
    const { calls, fetchImpl } = fakeFetch([
        jsonResponse({ images: [{ url: IMAGE_URL }] }),
        imageResponse(GENERATED_BYTES)
    ]);
    const adapter = new SiliconFlowImageAdapter({ apiKey: API_KEY, fetchImpl });
    const imageFile = { name: 'ms-fragrance-master.png', type: 'image/png', arrayBuffer: async () => IMAGE_BUFFER };

    const b64 = await adapter.generatePng({ prompt: PROMPT, imageFile });

    assert.equal(b64, GENERATED_B64);
    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.image, IMAGE_DATA_URL);
});

// ── 3. Validation before any request ───────────────────────────────────
test('rejects with 503 when the API key is missing', async () => {
    const { fetchImpl } = fakeFetch();
    const adapter = new SiliconFlowImageAdapter({ fetchImpl });

    await assert.rejects(
        () => adapter.generatePng({ prompt: PROMPT, imageBuffer: IMAGE_BUFFER }),
        (error) => {
            assert.equal(error.statusCode, 503);
            assert.equal(error.code, 'SILICONFLOW_NOT_CONFIGURED');
            return true;
        }
    );
    // No request is attempted when the provider is not configured.
});

test('rejects with 503 when the fetch implementation is unavailable', async () => {
    // Node 22 provides a global fetch, so hide it to simulate a fetch-less
    // runtime (production falls back to the global fetch when fetchImpl is
    // not injected).
    const originalFetch = globalThis.fetch;
    try {
        // @ts-ignore - simulating a runtime without fetch
        delete globalThis.fetch;
        const adapter = new SiliconFlowImageAdapter({ apiKey: API_KEY });
        assert.equal(adapter.fetch, null);

        await assert.rejects(
        () => adapter.generatePng({ prompt: PROMPT, imageBuffer: IMAGE_BUFFER }),
        (error) => {
            assert.equal(error.statusCode, 503);
            assert.equal(error.code, 'SILICONFLOW_UNAVAILABLE');
            return true;
        }
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('rejects with 400 when the prompt is missing', async () => {
    const { fetchImpl } = fakeFetch();
    const adapter = new SiliconFlowImageAdapter({ apiKey: API_KEY, fetchImpl });

    await assert.rejects(
        () => adapter.generatePng({ imageBuffer: IMAGE_BUFFER }),
        (error) => {
            assert.equal(error.statusCode, 400);
            assert.equal(error.code, 'SILICONFLOW_PROMPT_REQUIRED');
            return true;
        }
    );
});

test('rejects with 503 when the reference image is missing', async () => {
    const { fetchImpl } = fakeFetch();
    const adapter = new SiliconFlowImageAdapter({ apiKey: API_KEY, fetchImpl });

    await assert.rejects(
        () => adapter.generatePng({ prompt: PROMPT }),
        (error) => {
            assert.equal(error.statusCode, 503);
            assert.equal(error.code, 'SILICONFLOW_REFERENCE_IMAGE_MISSING');
            return true;
        }
    );
});

// ── 4. Provider errors ─────────────────────────────────────────────────
test('maps HTTP 429 to a safe 429 error', async () => {
    const { fetchImpl } = fakeFetch([jsonResponse({}, { status: 429 })]);
    const adapter = new SiliconFlowImageAdapter({ apiKey: API_KEY, fetchImpl });

    await assert.rejects(
        () => adapter.generatePng({ prompt: PROMPT, imageBuffer: IMAGE_BUFFER }),
        (error) => {
            assert.equal(error.statusCode, 429);
            assert.equal(error.code, 'SILICONFLOW_RATE_LIMITED');
            return true;
        }
    );
});

for (const status of [401, 403, 500]) {
    test(`maps HTTP ${status} to a safe 502 error without leaking the provider body`, async () => {
        const { fetchImpl } = fakeFetch([jsonResponse({}, { status })]);
        const adapter = new SiliconFlowImageAdapter({ apiKey: API_KEY, fetchImpl });

        await assert.rejects(
            () => adapter.generatePng({ prompt: PROMPT, imageBuffer: IMAGE_BUFFER }),
            (error) => {
                assert.equal(error.statusCode, 502);
                assert.equal(error.code, 'SILICONFLOW_REQUEST_FAILED');
                assert.ok(!error.message.includes(API_KEY), 'API key must not leak');
                assert.ok(!error.message.includes(PROMPT), 'prompt must not leak');
                return true;
            }
        );
    });
}

test('maps request timeouts to a safe 504 error', async () => {
    const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    const { fetchImpl } = fakeFetch([abortError]);
    const adapter = new SiliconFlowImageAdapter({ apiKey: API_KEY, fetchImpl });

    await assert.rejects(
        () => adapter.generatePng({ prompt: PROMPT, imageBuffer: IMAGE_BUFFER }),
        (error) => {
            assert.equal(error.statusCode, 504);
            assert.equal(error.code, 'SILICONFLOW_TIMEOUT');
            return true;
        }
    );
});

test('maps network failures to a safe 502 error without leaking internals', async () => {
    const { fetchImpl } = fakeFetch([new Error('connect ECONNREFUSED 127.0.0.1:443')]);
    const adapter = new SiliconFlowImageAdapter({ apiKey: API_KEY, fetchImpl });

    await assert.rejects(
        () => adapter.generatePng({ prompt: PROMPT, imageBuffer: IMAGE_BUFFER }),
        (error) => {
            assert.equal(error.statusCode, 502);
            assert.equal(error.code, 'SILICONFLOW_REQUEST_FAILED');
            assert.ok(!error.message.includes('ECONNREFUSED'), 'network details must not leak');
            return true;
        }
    );
});

// ── 5. Malformed responses ─────────────────────────────────────────────
for (const payload of [
    {},
    { images: [] },
    { images: [{}] },
    { images: [{ url: '' }] },
    { images: [{ url: null }] }
]) {
    test(`rejects malformed generation response ${JSON.stringify(payload)} with 502`, async () => {
        const { fetchImpl } = fakeFetch([jsonResponse(payload)]);
        const adapter = new SiliconFlowImageAdapter({ apiKey: API_KEY, fetchImpl });

        await assert.rejects(
            () => adapter.generatePng({ prompt: PROMPT, imageBuffer: IMAGE_BUFFER }),
            (error) => {
                assert.equal(error.statusCode, 502);
                assert.equal(error.code, 'SILICONFLOW_INVALID_RESPONSE');
                return true;
            }
        );
    });
}

test('rejects an unparsable generation response with 502', async () => {
    const { fetchImpl } = fakeFetch([jsonResponse(new Error('Unexpected token < in JSON'))]);
    const adapter = new SiliconFlowImageAdapter({ apiKey: API_KEY, fetchImpl });

    await assert.rejects(
        () => adapter.generatePng({ prompt: PROMPT, imageBuffer: IMAGE_BUFFER }),
        (error) => error.code === 'SILICONFLOW_INVALID_RESPONSE'
    );
});

// ── 6. Image download failures ─────────────────────────────────────────
test('rejects download failures with 502', async () => {
    const { fetchImpl } = fakeFetch([
        jsonResponse({ images: [{ url: IMAGE_URL }] }),
        new Error('download boom')
    ]);
    const adapter = new SiliconFlowImageAdapter({ apiKey: API_KEY, fetchImpl });

    await assert.rejects(
        () => adapter.generatePng({ prompt: PROMPT, imageBuffer: IMAGE_BUFFER }),
        (error) => {
            assert.equal(error.statusCode, 502);
            assert.equal(error.code, 'SILICONFLOW_DOWNLOAD_FAILED');
            return true;
        }
    );
});

test('rejects download timeouts with 504', async () => {
    const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    const { fetchImpl } = fakeFetch([jsonResponse({ images: [{ url: IMAGE_URL }] }), abortError]);
    const adapter = new SiliconFlowImageAdapter({ apiKey: API_KEY, fetchImpl });

    await assert.rejects(
        () => adapter.generatePng({ prompt: PROMPT, imageBuffer: IMAGE_BUFFER }),
        (error) => {
            assert.equal(error.statusCode, 504);
            assert.equal(error.code, 'SILICONFLOW_DOWNLOAD_TIMEOUT');
            return true;
        }
    );
});

test('rejects a non-OK download with 502', async () => {
    const { fetchImpl } = fakeFetch([
        jsonResponse({ images: [{ url: IMAGE_URL }] }),
        jsonResponse({}, { status: 404 })
    ]);
    const adapter = new SiliconFlowImageAdapter({ apiKey: API_KEY, fetchImpl });

    await assert.rejects(
        () => adapter.generatePng({ prompt: PROMPT, imageBuffer: IMAGE_BUFFER }),
        (error) => error.code === 'SILICONFLOW_DOWNLOAD_FAILED'
    );
});

for (const contentType of ['text/html', 'application/json']) {
    test(`rejects a download with non-image content type ${contentType}`, async () => {
        const { fetchImpl } = fakeFetch([
            jsonResponse({ images: [{ url: IMAGE_URL }] }),
            imageResponse(GENERATED_BYTES, { contentType })
        ]);
        const adapter = new SiliconFlowImageAdapter({ apiKey: API_KEY, fetchImpl });

        await assert.rejects(
            () => adapter.generatePng({ prompt: PROMPT, imageBuffer: IMAGE_BUFFER }),
            (error) => error.code === 'SILICONFLOW_INVALID_RESPONSE'
        );
    });
}

test('rejects an empty download with 502', async () => {
    const { fetchImpl } = fakeFetch([
        jsonResponse({ images: [{ url: IMAGE_URL }] }),
        imageResponse(Buffer.alloc(0))
    ]);
    const adapter = new SiliconFlowImageAdapter({ apiKey: API_KEY, fetchImpl });

    await assert.rejects(
        () => adapter.generatePng({ prompt: PROMPT, imageBuffer: IMAGE_BUFFER }),
        (error) => error.code === 'SILICONFLOW_INVALID_RESPONSE'
    );
});

// ── 7. Integration with ProductAiService ───────────────────────────────
test('generates through ProductAiService with the master bottle reference image', async () => {
    const { calls, fetchImpl } = fakeFetch([
        jsonResponse({ images: [{ url: IMAGE_URL }] }),
        imageResponse(GENERATED_BYTES)
    ]);
    const adapter = new SiliconFlowImageAdapter({ apiKey: API_KEY, fetchImpl });
    const service = new ProductAiService({
        client: fakeOpenAiClient(),
        loadMasterImage: fakeLoadMasterImage(),
        imageAdapter: adapter
    });

    const image = await service.generateProductImage(product);

    assert.equal(image, GENERATED_B64);
    assert.equal(calls.length, 2);
    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.image, IMAGE_DATA_URL, 'service hands the master image to the adapter');
});