import AppError from '../../core/errors/AppError.js';
import EdenAiImageAdapter from './edenai.image.adapter.js';
import CloudflareImageAdapter, {
    DEFAULT_CLOUDFLARE_IMAGE_MODEL,
} from './cloudflare.image.adapter.js';
import SiliconFlowImageAdapter, {
    DEFAULT_SILICONFLOW_IMAGE_MODEL,
} from './siliconflow.image.adapter.js';
// Product image provider selection.
//
// PRODUCT_IMAGE_PROVIDER chooses which provider generates product images:
//   - "openai" (default): the existing built-in path in ProductAiService that
//     calls the OpenAI images.edit API with gpt-image-2 and the master bottle
//     reference image. Unchanged behaviour.
//   - "edenai": the Eden AI gateway (POST /v3/images/edits), configured with
//     EDEN_AI_API_KEY and EDEN_AI_IMAGE_MODEL.
//   - "cloudflare": Cloudflare Workers AI (POST
//     /client/v4/accounts/{ACCOUNT_ID}/ai/run/{MODEL}), configured with
//     CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN and CLOUDFLARE_IMAGE_MODEL.
//     The flux-1-schnell model is text-to-image only, so the master bottle
//     reference image is not sent to this provider (see
//     cloudflare.image.adapter.js).
//
// The default model below is the same gpt-image-2 model exposed through Eden
// AI's gateway ("openai/gpt-image-2"), which supports reference-image input
// on the edits endpoint. Override with EDEN_AI_IMAGE_MODEL when needed; any
// model that does not accept reference images will surface a safe provider
// error at request time.
//
// The Cloudflare default model is the text-to-image
// "@cf/black-forest-labs/flux-1-schnell", verified from Cloudflare's official
// model docs. Override with CLOUDFLARE_IMAGE_MODEL when needed.
const SUPPORTED_IMAGE_PROVIDERS = [
    'openai',
    'edenai',
    'cloudflare',
    'siliconflow',
];
const DEFAULT_IMAGE_PROVIDER = 'openai';
const DEFAULT_EDENAI_IMAGE_MODEL = 'openai/gpt-image-2';

/**
 * Resolve and validate the configured product image provider.
 * @param {Object} [env] - Environment map (defaults to process.env)
 * @returns {'openai'|'edenai'|'cloudflare'} validated provider name
 * @throws {AppError} 500 UNSUPPORTED_IMAGE_PROVIDER for unknown names
 */
function resolveImageProvider(env = process.env) {
    const raw = String(env.PRODUCT_IMAGE_PROVIDER ?? '').trim().toLowerCase() || DEFAULT_IMAGE_PROVIDER;

    if (!SUPPORTED_IMAGE_PROVIDERS.includes(raw)) {
        throw new AppError(
            `Unsupported product image provider "${raw}". Supported providers: ${SUPPORTED_IMAGE_PROVIDERS.join(', ')}.`,
            500,
            'UNSUPPORTED_IMAGE_PROVIDER'
        );
    }

    return raw;
}

/**
 * Build the image adapter for the configured provider.
 *
 * Returns null for the default "openai" provider so ProductAiService keeps
 * its existing built-in OpenAI path (preserving behaviour and tests); returns
 * an EdenAiImageAdapter when PRODUCT_IMAGE_PROVIDER=edenai and a
 * CloudflareImageAdapter when PRODUCT_IMAGE_PROVIDER=cloudflare.
 *
 * @param {Object} [options]
 * @param {Object} [options.env] - Environment map (defaults to process.env)
 * @param {Function} [options.fetchImpl] - fetch override for tests
 * @param {number} [options.timeoutMs] - request timeout override for tests
 * @returns {EdenAiImageAdapter|CloudflareImageAdapter|null}
 * @throws {AppError} 500 UNSUPPORTED_IMAGE_PROVIDER for unknown names
 */
function createProductImageAdapter({ env = process.env, fetchImpl, timeoutMs } = {}) {
    const provider = resolveImageProvider(env);

    if (provider === 'edenai') {
        return new EdenAiImageAdapter({
            apiKey: env.EDEN_AI_API_KEY,
            model: (env.EDEN_AI_IMAGE_MODEL || DEFAULT_EDENAI_IMAGE_MODEL).trim(),
            fetchImpl,
            timeoutMs
        });
    }

    if (provider === 'cloudflare') {
        return new CloudflareImageAdapter({
            accountId: env.CLOUDFLARE_ACCOUNT_ID,
            apiToken: env.CLOUDFLARE_API_TOKEN,
            model: (env.CLOUDFLARE_IMAGE_MODEL || DEFAULT_CLOUDFLARE_IMAGE_MODEL).trim(),
            fetchImpl,
            timeoutMs
        });
    }

    if (provider === 'siliconflow') {
        return new SiliconFlowImageAdapter({
            apiKey: env.SILICONFLOW_API_KEY,
            model: (
                env.SILICONFLOW_IMAGE_MODEL ||
                DEFAULT_SILICONFLOW_IMAGE_MODEL
            ).trim(),
            fetchImpl,
            timeoutMs,
        });
    }

    return null;
}

export {
    SUPPORTED_IMAGE_PROVIDERS,
    DEFAULT_IMAGE_PROVIDER,
    DEFAULT_EDENAI_IMAGE_MODEL,
    DEFAULT_CLOUDFLARE_IMAGE_MODEL,
    resolveImageProvider,
    createProductImageAdapter,
};