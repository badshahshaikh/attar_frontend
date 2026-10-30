/**
 * productUrl.js — Canonical product URL generation.
 *
 * Single source of truth for product navigation URLs. Uses the database
 * `slug` as the descriptive prefix and falls back to the numeric ID when
 * no slug is present. Never produces `undefined` or empty-slug URLs.
 *
 * Canonical format: /product/{slug}-{id}
 * Fallback format:  /product/{id}
 *
 * A console warning is emitted in development when a product lacks a slug,
 * so missing slug data is visible rather than silent.
 */
export function getProductUrl(product) {
    if (!product) return '/';
    const id = product.id;
    if (id == null) return '/';
    const slug = product.slug && String(product.slug).trim()
        ? String(product.slug).trim()
        : null;
    if (!slug) {
        console.warn(
            `[productUrl] Product id=${id} has no slug; falling back to numeric URL /product/${id}`
        );
    }
    return slug ? `/product/${slug}-${id}` : `/product/${id}`;
}

export function getProductUrlFromId(slug, id) {
    if (id == null) return '/';
    const cleanSlug = slug && String(slug).trim() ? String(slug).trim() : null;
    if (!cleanSlug) {
        console.warn(
            `[productUrl] Product id=${id} has no slug; falling back to numeric URL /product/${id}`
        );
    }
    return cleanSlug ? `/product/${cleanSlug}-${id}` : `/product/${id}`;
}
