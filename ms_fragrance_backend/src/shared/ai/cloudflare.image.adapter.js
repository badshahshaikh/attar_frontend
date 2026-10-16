import AppError from '../../core/errors/AppError.js';
import { logger } from '../logging/logger.js';

// Cloudflare Workers AI text-to-image endpoint. Verified against Cloudflare's
// official documentation:
// - REST guide: POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/{MODEL}
//   with `Authorization: Bearer {API_TOKEN}` returns a JSON envelope
//   { result, success, errors, messages }.
//   https://developers.cloudflare.com/workers-ai/get-started/rest-api/
// - flux-1-schnell model page: input { prompt (required), steps? (max 8,
//   default 4) }; output { image } where image is the generated image in
//   Base64 format (Workers binding: `response.image` is base64).
//   https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const DEFAULT_CLOUDFLARE_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

// Reference-image limitation: flux-1-schnell is a TEXT-TO-IMAGE model — its
// documented input schema accepts only `prompt` (plus optional steps/seed),
// so the master bottle reference image cannot be sent to this provider. The
// shared product prompt (which describes the bottle in detail) is still used.
// `supportsReferenceImage = false` lets ProductAiService skip loading the
// master image for this provider.

const DEFAULT_TIMEOUT_MS = 60000;

/**
 * CloudflareImageAdapter - Workers AI image provider for product images.
 *
 * Exposes the same generatePng({ prompt, ... }) contract as the built-in
 * OpenAI path in ProductAiService, and normalizes the Cloudflare response
 * into the same raw base64 string the frontend expects (res.json({ image })).
 *
 * Both documented success shapes are supported: the JSON envelope
 * { result: { image } } and a binary image/* body (decoded to base64).
 * Errors are mapped to safe AppErrors: the API token, account id, request
 * payload and raw provider bodies are never included in thrown errors or
 * logs, and full base64 payloads are never logged.
 */
class CloudflareImageAdapter {
    supportsReferenceImage = false;

    constructor({ accountId, apiToken, model, fetchImpl, timeoutMs } = {}) {
        this.accountId = accountId;
        this.apiToken = apiToken;
        this.model = model;
        // Injectable for tests; production uses the global fetch (Node 18+).
        this.fetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
        this.timeoutMs = timeoutMs || DEFAULT_TIMEOUT_MS;
    }

    async request(url, options) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            return await this.fetch(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    }

    invalidResponse() {
        return new AppError(
            'The image generation provider did not return an image. Please try again later.',
            502,
            'CLOUDFLARE_INVALID_RESPONSE'
        );
    }

    async generatePng({ prompt } = {}) {
        if (!this.accountId || !this.apiToken) {
            throw new AppError(
                'The Cloudflare image provider is not configured. Please try again later.',
                503,
                'CLOUDFLARE_NOT_CONFIGURED'
            );
        }

        if (!this.fetch) {
            throw new AppError(
                'The Cloudflare image provider is unavailable in this runtime. Please try again later.',
                503,
                'CLOUDFLARE_UNAVAILABLE'
            );
        }


        let response;
        try {
            response = await this.request(this.buildUrl(), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt })
            });
        } catch (error) {
            // Network failures and aborts (timeout). Log only the error shape —
            // never credentials, the prompt, or response payloads.
            const timedOut = error.name === 'AbortError' || error.name === 'TimeoutError';
            logger.error('[CLOUDFLARE_IMAGE_ERROR]', {
                stage: 'request',
                timedOut,
                errorCode: error.name || null
            });
            if (timedOut) {
                throw new AppError(
                    'The image generation request timed out. Please try again later.',
                    504,
                    'CLOUDFLARE_TIMEOUT'
                );
            }
            throw new AppError(
                'The image generation provider is unreachable. Please try again later.',
                502,
                'CLOUDFLARE_REQUEST_FAILED'
            );
        }

        if (response.status === 429) {
            // Rate limited — surfaced as 429 so callers can tell it apart from
            // generic provider failures. No body is logged or returned.
            logger.error('[CLOUDFLARE_IMAGE_ERROR]', {
                stage: 'response',
                statusCode: 429
            });
            throw new AppError(
                'The image generation provider is rate limited. Please try again later.',
                429,
                'CLOUDFLARE_RATE_LIMITED'
            );
        }

        if (!response.ok) {
            // Log the status only — provider error bodies can echo request data.
            logger.error('[CLOUDFLARE_IMAGE_ERROR]', {
                stage: 'response',
                statusCode: response.status
            });
            throw new AppError(
                'The image generation provider rejected the request. Please try again later.',
                502,
                'CLOUDFLARE_REQUEST_FAILED'
            );
        }

        const contentType =
            (response.headers && typeof response.headers.get === 'function'
                ? response.headers.get('content-type')
                : '') || '';

        let b64;
        if (String(contentType).toLowerCase().startsWith('image/')) {
            // Binary-image shape: read the bytes and base64-encode them so
            // downstream handling stays identical to the JSON path.
            let bytes;
            try {
                bytes = Buffer.from(await response.arrayBuffer());
            } catch (error) {
                logger.error('[CLOUDFLARE_IMAGE_ERROR]', {
                    stage: 'parse',
                    errorCode: error.name || null
                });
                throw this.invalidResponse();
            }
            if (!bytes.length) {
                logger.error('[CLOUDFLARE_IMAGE_ERROR]', { stage: 'normalize', emptyBody: true });
                throw this.invalidResponse();
            }
            b64 = bytes.toString('base64');
        } else {
            let payload;
            try {
                payload = await response.json();
            } catch (error) {
                logger.error('[CLOUDFLARE_IMAGE_ERROR]', {
                    stage: 'parse',
                    errorCode: error.name || null
                });
                throw this.invalidResponse();
            }

            b64 = payload && payload.result && payload.result.image;

            if (typeof b64 !== 'string' || !b64) {
                // Malformed or failed provider payload (e.g. success:false).
                // Log only the envelope flag — never the payload contents.
                logger.error('[CLOUDFLARE_IMAGE_ERROR]', {
                    stage: 'normalize',
                    success: !!(payload && payload.success)
                });
                throw this.invalidResponse();
            }
        }

        // Decode the base64 into an image buffer to verify integrity before
        // returning the base64 string the existing image workflow expects
        // (controller responds with res.json({ image })).
        const buffer = Buffer.from(b64, 'base64');
        if (!buffer.length) {
            logger.error('[CLOUDFLARE_IMAGE_ERROR]', { stage: 'normalize', emptyImage: true });
            throw this.invalidResponse();
        }

        return b64;
    }

    buildUrl() {
        // The model id is used verbatim in the path, as shown in Cloudflare's
        // documented curl example (it must NOT be URL-encoded).
        return `${CLOUDFLARE_API_BASE}/accounts/${this.accountId}/ai/run/${this.model}`;
    }
}

export { CLOUDFLARE_API_BASE, DEFAULT_CLOUDFLARE_IMAGE_MODEL, DEFAULT_TIMEOUT_MS };

export default CloudflareImageAdapter;
