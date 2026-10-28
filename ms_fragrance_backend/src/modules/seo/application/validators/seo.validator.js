import ValidationError from '../../../../core/errors/ValidationError.js';

const SEO_TITLE_MAX = 60;
const META_DESCRIPTION_MAX = 160;

const VALID_ROBOTS = new Set([
    'index,follow',
    'index,nofollow',
    'noindex,follow',
    'noindex,nofollow',
]);

const VALID_TWITTER_CARDS = new Set([
    'summary',
    'summary_large_image',
    'app',
    'player',
]);

const VALID_PAGE_TYPES = new Set([
    'homepage',
    'shop',
    'category',
    'product',
]);

function isValidRoutePath(value) {
    return (
        typeof value === 'string' &&
        value.trim() !== '' &&
        value.startsWith('/') &&
        !value.includes(' ')
    );
}

function isValidOptionalUrl(value) {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function isValidStructuredData(value) {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return (
                parsed !== null &&
                typeof parsed === 'object' &&
                !Array.isArray(parsed)
            );
        } catch {
            return false;
        }
    }
    return (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
    );
}

function validateSeoSettings(data, { isUpdate = false } = {}) {
    const errors = [];
    const normalized = {};

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new ValidationError('Invalid SEO settings: must be an object');
    }

    if (!isUpdate && !VALID_PAGE_TYPES.has(data.page_type)) {
        errors.push(
            `page_type is required and must be one of: ${[...VALID_PAGE_TYPES].join(', ')}`
        );
    } else if (
        data.page_type !== undefined &&
        !VALID_PAGE_TYPES.has(data.page_type)
    ) {
        errors.push(
            `Invalid page_type: ${data.page_type}. Must be one of: ${[...VALID_PAGE_TYPES].join(', ')}`
        );
    }
    normalized.page_type = data.page_type;

    const rawRoutePath = data.route_path;
    normalized.route_path = rawRoutePath ? String(rawRoutePath).trim() : '';
    const routePathForCheck = normalized.route_path;

    if (!isUpdate && !isValidRoutePath(routePathForCheck)) {
        errors.push(
            'route_path is required and must be a path starting with "/" (no spaces)'
        );
    } else if (
        rawRoutePath !== undefined &&
        !isValidRoutePath(routePathForCheck)
    ) {
        errors.push(
            'route_path must be a path starting with "/" and contain no spaces'
        );
    }

    normalized.seo_title = data.seo_title ? String(data.seo_title).trim() : '';
    if (normalized.seo_title.length > SEO_TITLE_MAX) {
        errors.push(
            `SEO title is too long (${normalized.seo_title.length} chars); recommended max ${SEO_TITLE_MAX}`
        );
    }

    normalized.meta_description = data.meta_description
        ? String(data.meta_description).trim()
        : '';
    if (normalized.meta_description.length > META_DESCRIPTION_MAX) {
        errors.push(
            `Meta description is too long (${normalized.meta_description.length} chars); recommended max ${META_DESCRIPTION_MAX}`
        );
    }

    normalized.canonical_url = data.canonical_url
        ? String(data.canonical_url).trim()
        : '';
    if (
        normalized.canonical_url &&
        !isValidOptionalUrl(normalized.canonical_url)
    ) {
        errors.push('canonical_url must be a valid absolute URL');
    }

    normalized.robots = data.robots ? String(data.robots).trim() : 'index,follow';
    if (!VALID_ROBOTS.has(normalized.robots)) {
        errors.push(
            `Invalid robots directive: ${normalized.robots}. Must be one of: ${[...VALID_ROBOTS].join(', ')}`
        );
    }

    normalized.og_title = data.og_title ? String(data.og_title).trim() : '';
    normalized.og_description = data.og_description
        ? String(data.og_description).trim()
        : '';
    normalized.og_image = data.og_image ? String(data.og_image).trim() : '';
    normalized.twitter_card = data.twitter_card
        ? String(data.twitter_card).trim()
        : 'summary_large_image';
    if (
        normalized.twitter_card &&
        !VALID_TWITTER_CARDS.has(normalized.twitter_card)
    ) {
        errors.push(
            `Invalid twitter_card: ${normalized.twitter_card}. Must be one of: ${[...VALID_TWITTER_CARDS].join(', ')}`
        );
    }
    normalized.twitter_title = data.twitter_title ? String(data.twitter_title).trim() : '';
    normalized.twitter_description = data.twitter_description
        ? String(data.twitter_description).trim()
        : '';
    normalized.twitter_image = data.twitter_image ? String(data.twitter_image).trim() : '';

    if (
        normalized.og_image.length > 0 &&
        !isValidOptionalUrl(normalized.og_image)
    ) {
        errors.push('og_image must be a valid absolute URL');
    }
    if (
        normalized.twitter_image.length > 0 &&
        !isValidOptionalUrl(normalized.twitter_image)
    ) {
        errors.push('twitter_image must be a valid absolute URL');
    }

    if (!isValidStructuredData(data.structured_data)) {
        errors.push('structured_data must be a valid JSON object');
    }
    normalized.structured_data =
        data.structured_data === undefined || data.structured_data === null
            ? {}
            : typeof data.structured_data === 'string'
              ? JSON.parse(data.structured_data)
              : data.structured_data;

    normalized.product_id =
        data.product_id === undefined || data.product_id === null
            ? null
            : Number(data.product_id);
    if (
        normalized.product_id !== null &&
        !Number.isInteger(normalized.product_id)
    ) {
        errors.push('product_id must be an integer');
    }

    normalized.is_published =
        data.is_published === undefined ? true : Boolean(data.is_published);

    if (errors.length > 0) {
        throw new ValidationError('SEO validation failed', errors);
    }

    return { errors: [], normalized };
}

export {
    validateSeoSettings,
    SEO_TITLE_MAX,
    META_DESCRIPTION_MAX,
    VALID_PAGE_TYPES,
    VALID_ROBOTS,
    VALID_TWITTER_CARDS,
    isValidRoutePath,
    isValidOptionalUrl,
    isValidStructuredData,
};
