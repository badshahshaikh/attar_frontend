/**
 * seoValidator.js - Validation utilities for SEO settings (client-side)
 *
 * Mirrors backend validation rules for fast feedback. Backend remains source of truth.
 */

export const SEO_TITLE_MAX = 60;
export const META_DESCRIPTION_MAX = 160;

export const VALID_PAGE_TYPES = ['homepage', 'shop', 'category', 'product'];
export const VALID_ROBOTS = ['index,follow', 'index,nofollow', 'noindex,follow', 'noindex,nofollow'];
export const VALID_TWITTER_CARDS = ['summary', 'summary_large_image', 'app', 'player'];

export function isValidRoutePath(value) {
    return typeof value === 'string' && value.trim() !== '' && value.startsWith('/') && !value.includes(' ');
}

export function isValidOptionalUrl(value) {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

export function isValidStructuredData(value) {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
        } catch {
            return false;
        }
    }
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateSeoSettings(settings, { isUpdate = false } = {}) {
    const errors = [];

    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return ['Invalid SEO settings: must be an object'];
    }

    if (!isUpdate && !VALID_PAGE_TYPES.includes(settings.page_type)) {
        errors.push(`page_type is required and must be one of: ${VALID_PAGE_TYPES.join(', ')}`);
    } else if (settings.page_type !== undefined && settings.page_type !== null && settings.page_type !== '' && !VALID_PAGE_TYPES.includes(settings.page_type)) {
        errors.push(`Invalid page_type: ${settings.page_type}. Must be one of: ${VALID_PAGE_TYPES.join(', ')}`);
    }

    const routePath = settings.route_path ? String(settings.route_path).trim() : '';
    if (!isUpdate && !isValidRoutePath(routePath)) {
        errors.push('route_path is required and must be a path starting with "/" (no spaces)');
    } else if (settings.route_path !== undefined && settings.route_path !== null && settings.route_path !== '' && !isValidRoutePath(routePath)) {
        errors.push('route_path must be a path starting with "/" and contain no spaces');
    }

    const seoTitle = settings.seo_title ? String(settings.seo_title).trim() : '';
    if (seoTitle.length > SEO_TITLE_MAX) {
        errors.push(`SEO title is too long (${seoTitle.length} chars); recommended max ${SEO_TITLE_MAX}`);
    }

    const metaDesc = settings.meta_description ? String(settings.meta_description).trim() : '';
    if (metaDesc.length > META_DESCRIPTION_MAX) {
        errors.push(`Meta description is too long (${metaDesc.length} chars); recommended max ${META_DESCRIPTION_MAX}`);
    }

    const canonical = settings.canonical_url ? String(settings.canonical_url).trim() : '';
    if (canonical && !isValidOptionalUrl(canonical)) {
        errors.push('canonical_url must be a valid absolute URL');
    }

    const robots = settings.robots ? String(settings.robots).trim() : 'index,follow';
    if (!VALID_ROBOTS.includes(robots)) {
        errors.push(`Invalid robots directive: ${robots}. Must be one of: ${VALID_ROBOTS.join(', ')}`);
    }

    const twitterCard = settings.twitter_card ? String(settings.twitter_card).trim() : 'summary_large_image';
    if (twitterCard && !VALID_TWITTER_CARDS.includes(twitterCard)) {
        errors.push(`Invalid twitter_card: ${twitterCard}. Must be one of: ${VALID_TWITTER_CARDS.join(', ')}`);
    }

    const ogImage = settings.og_image ? String(settings.og_image).trim() : '';
    if (ogImage && !isValidOptionalUrl(ogImage)) {
        errors.push('og_image must be a valid absolute URL');
    }

    const twitterImage = settings.twitter_image ? String(settings.twitter_image).trim() : '';
    if (twitterImage && !isValidOptionalUrl(twitterImage)) {
        errors.push('twitter_image must be a valid absolute URL');
    }

    if (!isValidStructuredData(settings.structured_data)) {
        errors.push('structured_data must be a valid JSON object');
    }

    if (settings.product_id !== undefined && settings.product_id !== null && settings.product_id !== '') {
        const n = Number(settings.product_id);
        if (!Number.isInteger(n)) {
            errors.push('product_id must be an integer');
        }
    }

    return errors;
}