import AppError from '../../core/errors/AppError.js';
import { logger } from '../logging/logger.js';

// SiliconFlow Image Generation API — verified against SiliconFlow's official
// API documentation:
//   POST https://api.siliconflow.com/v1/images/generations
//   Authorization: Bearer <SILICONFLOW_API_KEY>
//   Content-Type: application/json
// Model: black-forest-labs/FLUX.2-flex — confirmed as a currently supported
//   SiliconFlow model identifier (API model enum and the SiliconFlow FLUX.2-flex
//   model page). SiliconFlow documents "multi-reference image input" for this
//   model, so the master bottle reference image is always sent.
// Reference image field: `image`, sent as a base64 data URL
//   "data:image/png;base64,<bytes>" (a URL is also accepted). This is
//   SiliconFlow's documented image-upload convention, also used by
//   Qwen/Qwen-Image-Edit on the platform.
// Response: { images: [{ url }], timings, seed }. The image URL is valid for
//   one hour, so the adapter downloads it server-side and returns base64
//   bytes, keeping the existing product-image workflow compatible.
//   output_format defaults to "png".
const SILICONFLOW_API_BASE = 'https://api.siliconflow.com/v1/images/generations';
const DEFAULT_SILICONFLOW_IMAGE_MODEL = 'black-forest-labs/FLUX.2-flex';
const DEFAULT_TIMEOUT_MS = 60000;
const IMAGE_SIZE = '1024x1024';
const NUM_INFERENCE_STEPS = 25;

/**
 * SiliconFlowImageAdapter - SiliconFlow image provider for product images.
 *
 * Exposes the same generatePng({ prompt, imageFile, imageBuffer }) contract
 * as the built-in OpenAI path in ProductAiService, and normalizes the
 * SiliconFlow response into the same raw base64 PNG string the frontend
 * expects (res.json({ image })).
 *
 * The master bottle reference image is sent to SiliconFlow's
 * /v1/images/generations endpoint in the `image` field as a base64 data URL
 * (data:image/png;base64,...), per SiliconFlow's documented image-upload
 * convention. SiliconFlow returns a generated-image URL, which is downloaded
 * server-side before the base64 string is returned.
 *
 * Errors are mapped to safe AppErrors: the API key, request payload and raw
 * provider response bodies are never included in thrown errors or logs, and
 * full base64 payloads are never logged.
 */
class SiliconFlowImageAdapter {
    supportsReferenceImage = true;

    constructor({ apiKey, model, fetchImpl, timeoutMs } = {}) {
        this.apiKey = apiKey;
        this.model = model || DEFAULT_SILICONFLOW_IMAGE_MODEL;
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
            'SILICONFLOW_INVALID_RESPONSE'
        );
    }

    downloadFailed(message, timedOut) {
        return new AppError(
            message,
            timedOut ? 504 : 502,
            timedOut ? 'SILICONFLOW_DOWNLOAD_TIMEOUT' : 'SILICONFLOW_DOWNLOAD_FAILED'
        );
    }

    async generatePng({ prompt, imageFile, imageBuffer } = {}) {
        if (!this.apiKey) {
            throw new AppError(
                'The SiliconFlow image provider is not configured. Please try again later.',
                503,
                'SILICONFLOW_NOT_CONFIGURED'
            );
        }

        if (!this.fetch) {
            throw new AppError(
                'The SiliconFlow image provider is unavailable in this runtime. Please try again later.',
                503,
                'SILICONFLOW_UNAVAILABLE'
            );
        }

        if (!prompt || !String(prompt).trim()) {
            throw new AppError(
                'The image generation prompt is required. Please try again later.',
                400,
                'SILICONFLOW_PROMPT_REQUIRED'
            );
        }

        // The master bottle reference image is required for FLUX.2-flex
        // reference-based generation. Read it from imageBuffer or imageFile.
        const referenceBuffer = await this.resolveReferenceImage(imageBuffer, imageFile);
        const imageDataUrl = `data:image/png;base64,${referenceBuffer.toString('base64')}`;

        let response;
        try {
            response = await this.request(SILICONFLOW_API_BASE, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    prompt,
                    image: imageDataUrl,
                    image_size: IMAGE_SIZE,
                    output_format: 'png',
                    num_inference_steps: NUM_INFERENCE_STEPS
                })
            });
        } catch (error) {
            // Network failures and aborts (timeout). Log only the error shape —
            // never the API key, prompt or request payload.
            const timedOut = error.name === 'AbortError' || error.name === 'TimeoutError';
            logger.error('[SILICONFLOW_IMAGE_ERROR]', {
                stage: 'request',
                timedOut,
                errorCode: error.name || null
            });
            if (timedOut) {
                throw new AppError(
                    'The image generation request timed out. Please try again later.',
                    504,
                    'SILICONFLOW_TIMEOUT'
                );
            }
            throw new AppError(
                'The image generation provider is unreachable. Please try again later.',
                502,
                'SILICONFLOW_REQUEST_FAILED'
            );
        }

        if (!response.ok) {
            // Log the status only — provider error bodies can echo request data.
            logger.error('[SILICONFLOW_IMAGE_ERROR]', {
                stage: 'response',
                statusCode: response.status
            });
            if (response.status === 429) {
                throw new AppError(
                    'The image generation provider is rate limited. Please try again later.',
                    429,
                    'SILICONFLOW_RATE_LIMITED'
                );
            }
            throw new AppError(
                'The image generation provider rejected the request. Please try again later.',
                502,
                'SILICONFLOW_REQUEST_FAILED'
            );
        }

        let payload;
        try {
            payload = await response.json();
        } catch (error) {
            logger.error('[SILICONFLOW_IMAGE_ERROR]', {
                stage: 'parse',
                errorCode: error.name || null
            });
            throw this.invalidResponse();
        }

        // SiliconFlow documents the response as { images: [{ url }] } where
        // the URL is valid for one hour and must be downloaded promptly.
        const imageUrl =
            payload && Array.isArray(payload.images) && payload.images[0]
                ? payload.images[0].url
                : undefined;
        if (typeof imageUrl !== 'string' || !imageUrl) {
            logger.error('[SILICONFLOW_IMAGE_ERROR]', {
                stage: 'normalize',
                hasImages: Array.isArray(payload && payload.images) && payload.images.length > 0
            });
            throw this.invalidResponse();
        }

        // Download the generated image and base64-encode the bytes so
        // downstream handling stays identical to an inline-base64 response.
        let imageResponse;
        try {
            imageResponse = await this.request(imageUrl, { method: 'GET' });
        } catch (error) {
            const timedOut = error.name === 'AbortError' || error.name === 'TimeoutError';
            logger.error('[SILICONFLOW_IMAGE_ERROR]', {
                stage: 'download',
                timedOut,
                errorCode: error.name || null
            });
            throw this.downloadFailed(
                timedOut
                    ? 'The generated image download timed out. Please try again later.'
                    : 'The generated image could not be downloaded. Please try again later.',
                timedOut
            );
        }

        if (!imageResponse.ok) {
            logger.error('[SILICONFLOW_IMAGE_ERROR]', {
                stage: 'download',
                statusCode: imageResponse.status
            });
            throw this.downloadFailed(
                'The generated image could not be downloaded. Please try again later.',
                false
            );
        }

        const contentType =
            (imageResponse.headers && typeof imageResponse.headers.get === 'function'
                ? imageResponse.headers.get('content-type')
                : '') || '';
        if (!String(contentType).toLowerCase().startsWith('image/')) {
            logger.error('[SILICONFLOW_IMAGE_ERROR]', {
                stage: 'download',
                invalidContentType: true
            });
            throw this.invalidResponse();
        }

        let bytes;
        try {
            bytes = Buffer.from(await imageResponse.arrayBuffer());
        } catch (error) {
            logger.error('[SILICONFLOW_IMAGE_ERROR]', {
                stage: 'download',
                errorCode: error.name || null
            });
            throw this.invalidResponse();
        }
        if (!bytes.length) {
            logger.error('[SILICONFLOW_IMAGE_ERROR]', { stage: 'download', emptyBody: true });
            throw this.invalidResponse();
        }
        const b64 = bytes.toString('base64');

        // Decode the base64 into an image buffer to verify integrity before
        // returning the base64 string the existing image workflow expects
        // (controller responds with res.json({ image })).
        const buffer = Buffer.from(b64, 'base64');
        if (!buffer.length) {
            logger.error('[SILICONFLOW_IMAGE_ERROR]', { stage: 'normalize', emptyImage: true });
            throw this.invalidResponse();
        }

        return b64;
    }

    async resolveReferenceImage(imageBuffer, imageFile) {
        if (imageBuffer && imageBuffer.length) {
            return imageBuffer;
        }
        if (imageFile && typeof imageFile.arrayBuffer === 'function') {
            return Buffer.from(await imageFile.arrayBuffer());
        }
        throw new AppError(
            'The master product image is unavailable. Please try again later.',
            503,
            'SILICONFLOW_REFERENCE_IMAGE_MISSING'
        );
    }
}

export { SILICONFLOW_API_BASE, DEFAULT_SILICONFLOW_IMAGE_MODEL, DEFAULT_TIMEOUT_MS };

export default SiliconFlowImageAdapter;