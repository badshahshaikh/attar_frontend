import AppError from '../../core/errors/AppError.js';
import CloudflareTextAdapter, {
    DEFAULT_CLOUDFLARE_TEXT_MODEL,
} from './cloudflare.text.adapter.js';

// Product text provider selection (AI Fill).
//
// PRODUCT_TEXT_PROVIDER chooses which provider generates product text:
//   - "openai" (default): the existing OpenAI responses.create call with
//     gpt-5.5 inside ProductAiService. Unchanged behaviour.
//   - "cloudflare": Cloudflare Workers AI (POST
//     /client/v4/accounts/{ACCOUNT_ID}/ai/run/{MODEL}), configured with
//     CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN and CLOUDFLARE_TEXT_MODEL.
//
// The image-model flux-1-schnell is text-to-image only and CANNOT generate
// text, so the default text model is the JSON-Mode-capable
// "@cf/meta/llama-3.1-8b-instruct" (see cloudflare.text.adapter.js).
// Image configuration (PRODUCT_IMAGE_PROVIDER / CLOUDFLARE_IMAGE_MODEL) is
// untouched — this factory never reads image settings.
const SUPPORTED_TEXT_PROVIDERS = ['openai', 'cloudflare'];
const DEFAULT_TEXT_PROVIDER = 'openai';

function resolveTextProvider(env = process.env) {
    const raw = String(env.PRODUCT_TEXT_PROVIDER ?? '').trim().toLowerCase() || DEFAULT_TEXT_PROVIDER;

    if (!SUPPORTED_TEXT_PROVIDERS.includes(raw)) {
        throw new AppError(
            `Unsupported product text provider "${raw}". Supported providers: ${SUPPORTED_TEXT_PROVIDERS.join(', ')}.`,
            500,
            'UNSUPPORTED_TEXT_PROVIDER'
        );
    }

    return raw;
}

function createProductTextAdapter({ env = process.env, fetchImpl, timeoutMs } = {}) {
    const provider = resolveTextProvider(env);

    if (provider === 'cloudflare') {
        return new CloudflareTextAdapter({
            accountId: env.CLOUDFLARE_ACCOUNT_ID,
            apiToken: env.CLOUDFLARE_API_TOKEN,
            model: (env.CLOUDFLARE_TEXT_MODEL || DEFAULT_CLOUDFLARE_TEXT_MODEL).trim(),
            fetchImpl,
            timeoutMs
        });
    }

    return null;
}

export {
    SUPPORTED_TEXT_PROVIDERS,
    DEFAULT_TEXT_PROVIDER,
    DEFAULT_CLOUDFLARE_TEXT_MODEL,
    resolveTextProvider,
    createProductTextAdapter,
};
