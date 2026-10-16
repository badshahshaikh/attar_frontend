import AppError from '../../core/errors/AppError.js';
import { logger } from '../logging/logger.js';

// Cloudflare Workers AI text-generation adapter for AI Fill.
// Verified against Cloudflare's official documentation:
// - REST guide: POST .../accounts/{ACCOUNT_ID}/ai/run/{MODEL} with
//   `Authorization: Bearer {API_TOKEN}`. Text example uses
//   `@cf/meta/llama-3.1-8b-instruct` with a `{ "prompt": "..." }` body and
//   returns `{ result: { response }, success, errors, messages }`.
//   https://developers.cloudflare.com/workers-ai/get-started/rest-api/
// - JSON Mode: `response_format: { type: "json_schema", json_schema }`
//   alongside `messages: [{ role, content }]`; supported models include
//   `@cf/meta/llama-3.1-8b-instruct` (the default below).
//   https://developers.cloudflare.com/workers-ai/features/json-mode/
//
// The image model (@cf/black-forest-labs/flux-1-schnell) is text-to-image
// only and CANNOT generate text — a dedicated text model is required here.
const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const DEFAULT_CLOUDFLARE_TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

const DEFAULT_TIMEOUT_MS = 60000;

/**
 * CloudflareTextAdapter - Workers AI text provider for AI Fill.
 * Returns the model's raw JSON string; ProductAiService keeps validation.
 * Secrets, payloads and raw provider bodies are never logged or thrown.
 */
class CloudflareTextAdapter {
    constructor({ accountId, apiToken, model, fetchImpl, timeoutMs } = {}) {
        this.accountId = accountId;
        this.apiToken = apiToken;
        this.model = model;
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
            'The product information provider did not return valid data. Please try again later.',
            502,
            'CLOUDFLARE_TEXT_INVALID_RESPONSE'
        );
    }

    async generateProductJson({ instructions, input, schema } = {}) {
        if (!this.accountId || !this.apiToken) {
            throw new AppError(
                'The Cloudflare text provider is not configured. Please try again later.',
                503,
                'CLOUDFLARE_TEXT_NOT_CONFIGURED'
            );
        }

        if (!this.fetch) {
            throw new AppError(
                'The Cloudflare text provider is unavailable in this runtime. Please try again later.',
                503,
                'CLOUDFLARE_TEXT_UNAVAILABLE'
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
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: instructions },
                        { role: 'user', content: input }
                    ],
                    response_format: { type: 'json_schema', json_schema: schema }
                })
            });
        } catch (error) {
            if (error && error.name === 'AbortError') {
                logger.error('[CLOUDFLARE_TEXT_ERROR]', { stage: 'request', errorCode: 'TIMEOUT' });
                throw new AppError(
                    'The product information provider timed out. Please try again later.',
                    504,
                    'CLOUDFLARE_TEXT_TIMEOUT'
                );
            }
            logger.error('[CLOUDFLARE_TEXT_ERROR]', { stage: 'request', errorCode: (error && error.name) || null });
            throw new AppError(
                'The product information provider is unreachable. Please try again later.',
                502,
                'CLOUDFLARE_TEXT_REQUEST_FAILED'
            );
        }

        if (response.status === 429) {
            logger.error('[CLOUDFLARE_TEXT_ERROR]', { stage: 'response', statusCode: 429 });
            throw new AppError(
                'The product information provider is rate limited. Please try again later.',
                429,
                'CLOUDFLARE_TEXT_RATE_LIMITED'
            );
        }

        if (!response.ok) {
            logger.error('[CLOUDFLARE_TEXT_ERROR]', { stage: 'response', statusCode: response.status });
            throw new AppError(
                'The product information provider rejected the request. Please try again later.',
                502,
                'CLOUDFLARE_TEXT_REQUEST_FAILED'
            );
        }

        let payload;
        try {
            payload = await response.json();
        } catch (error) {
            logger.error('[CLOUDFLARE_TEXT_ERROR]', { stage: 'parse', errorCode: (error && error.name) || null });
            throw this.invalidResponse();
        }

        // Cloudflare Workers AI may return HTTP 200 with an error body when the
        // model cannot satisfy the request (e.g. "JSON Mode couldn't be met"). In
        // that case result.response is absent or null and success is false.
        if (payload && payload.success === false) {
            logger.error('[CLOUDFLARE_TEXT_ERROR]', {
                stage: 'response',
                success: false,
                errorCount: Array.isArray(payload.errors) ? payload.errors.length : null,
            });
            throw this.invalidResponse();
        }

                
        const result = payload?.result?.response;

        if (typeof result === 'string') {
            if (!result.trim()) {
                logger.error('[CLOUDFLARE_TEXT_ERROR]', {
                    stage: 'normalize',
                    responseType: 'string',
                    empty: true,
                });
                throw this.invalidResponse();
            }

            return result;
        }

        if (
            result !== null &&
            typeof result === 'object' &&
            !Array.isArray(result)
        ) {
            return JSON.stringify(result);
        }

        logger.error('[CLOUDFLARE_TEXT_ERROR]', {
            stage: 'normalize',
            responseType: result === null ? 'null' : typeof result,
            empty: result === undefined,
        });

        throw this.invalidResponse();

    }

    buildUrl() {
        return `${CLOUDFLARE_API_BASE}/accounts/${this.accountId}/ai/run/${this.model}`;
    }
}

export { CLOUDFLARE_API_BASE, DEFAULT_CLOUDFLARE_TEXT_MODEL, DEFAULT_TIMEOUT_MS };

export default CloudflareTextAdapter;