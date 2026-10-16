import AppError from '../../core/errors/AppError.js';
import { logger } from '../logging/logger.js';

// Eden AI image-edit endpoint (OpenAI-compatible). Verified against Eden AI's
// official API reference: POST /v3/images/edits accepts a JSON body with
// { model, prompt, images: [{ image_url | file_id }], n, size } and returns an
// OpenAI-shaped response { data: [{ url | b64_json }], ... }.
// https://www.edenai.co/docs/api-reference/images/image-edits
const EDEN_AI_IMAGE_EDITS_URL = 'https://api.edenai.run/v3/images/edits';

// Reference-image support: the "images" input is documented as accepting an
// https URL or a base64 data URL per entry, so the master bottle image is sent
// inline as data:image/png;base64,.... The default model (openai/gpt-image-2)
// is a documented Eden AI image model that accepts reference input; models that
// do not accept reference images surface a provider failure, which is mapped
// to a safe 502 below.

const DEFAULT_TIMEOUT_MS = 60000;
const IMAGE_SIZE = '1024x1024';

/**
 * EdenAiImageAdapter - alternative image provider for product images.
 *
 * Exposes the same generatePng({ prompt, imageFile, imageBuffer }) contract as
 * the built-in OpenAI path in ProductAiService, and normalizes the Eden AI
 * response into the same raw base64 PNG string the frontend expects.
 *
 * Errors are mapped to safe AppErrors: the API key, request payload and raw
 * provider response bodies are never included in thrown errors or logs.
 */
class EdenAiImageAdapter {
    constructor({ apiKey, model, fetchImpl, timeoutMs } = {}) {
        this.apiKey = apiKey;
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

    async generatePng({ prompt, imageBuffer } = {}) {
        if (!this.apiKey) {
            throw new AppError(
                'The Eden AI image provider is not configured. Please try again later.',
                503,
                'EDEN_AI_NOT_CONFIGURED'
            );
        }

        if (!this.fetch) {
            throw new AppError(
                'The Eden AI image provider is unavailable in this runtime. Please try again later.',
                503,
                'EDEN_AI_UNAVAILABLE'
            );
        }

        if (!imageBuffer || imageBuffer.length === 0) {
            throw new AppError(
                'The master product image is unavailable. Please try again later.',
                503,
                'MASTER_IMAGE_INVALID'
            );
        }

        const imageDataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;

        let response;
        try {
            response = await this.request(EDEN_AI_IMAGE_EDITS_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    prompt,
                    images: [{ image_url: imageDataUrl }],
                    n: 1,
                    size: IMAGE_SIZE
                })
            });
        } catch (error) {
            // Network failures and aborts (timeout). Log only the error shape —
            // never the API key or request payload.
            const timedOut = error.name === 'AbortError' || error.name === 'TimeoutError';
            logger.error('[EDEN_AI_IMAGE_ERROR]', {
                stage: 'request',
                timedOut,
                errorCode: error.name || null,
                errorMessage: error.message
            });
            if (timedOut) {
                throw new AppError(
                    'The image generation request timed out. Please try again later.',
                    504,
                    'EDEN_AI_TIMEOUT'
                );
            }
            throw new AppError(
                'The image generation provider is unreachable. Please try again later.',
                502,
                'EDEN_AI_REQUEST_FAILED'
            );
        }

        if (!response.ok) {
            // Log the status only — provider error bodies can echo request data.
            logger.error('[EDEN_AI_IMAGE_ERROR]', {
                stage: 'response',
                statusCode: response.status
            });
            throw new AppError(
                'The image generation provider rejected the request. Please try again later.',
                502,
                'EDEN_AI_REQUEST_FAILED'
            );
        }

        let payload;
        try {
            payload = await response.json();
        } catch (error) {
            logger.error('[EDEN_AI_IMAGE_ERROR]', {
                stage: 'parse',
                errorMessage: error.message
            });
            throw new AppError(
                'The image generation provider returned an unexpected response. Please try again later.',
                502,
                'EDEN_AI_INVALID_RESPONSE'
            );
        }

        const b64 = payload && Array.isArray(payload.data) && payload.data[0] && payload.data[0].b64_json;

        if (typeof b64 !== 'string' || !b64) {
            // Malformed or failed provider payload (e.g. status "fail" from a
            // model without reference-image support).
            logger.error('[EDEN_AI_IMAGE_ERROR]', {
                stage: 'normalize',
                status: payload && payload.status ? payload.status : null
            });
            throw new AppError(
                'The image generation provider did not return an image. Please try again later.',
                502,
                'EDEN_AI_INVALID_RESPONSE'
            );
        }

        return b64;
    }
}

export default EdenAiImageAdapter;
export { EDEN_AI_IMAGE_EDITS_URL, IMAGE_SIZE, DEFAULT_TIMEOUT_MS };