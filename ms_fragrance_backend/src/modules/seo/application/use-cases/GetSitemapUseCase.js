import { logger } from '../../../../shared/logging/logger.js';

const NON_INDEXABLE_PREFIXES = ['/cart', '/checkout', '/wishlist', '/account', '/login', '/register', '/admin'];

function isNonIndexableRoute(routePath) {
    return NON_INDEXABLE_PREFIXES.some((p) => routePath === p || routePath.startsWith(p + '/'));
}

function isValidUrl(value) {
    if (!value) return false;
    try {
        const u = new URL(value);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

class GetSitemapUseCase {
    constructor({ seoRepository, listProducts, siteUrl }) {
        this.seoRepository = seoRepository;
        this.listProducts = listProducts || (async () => []);
        this.siteUrl = String(siteUrl || '').replace(/\/+$/, '');
    }

    async execute() {
        const urls = new Map();

        const addUrl = (loc, meta = {}) => {
            if (!loc || !isValidUrl(loc)) return;
            if (urls.has(loc)) return;
            urls.set(loc, {
                loc,
                lastmod: meta.lastmod || null,
                changefreq: meta.changefreq || 'weekly',
                priority: meta.priority != null ? meta.priority : 0.5,
            });
        };

        const resolveLoc = (routePath, canonicalUrl) => {
            if (canonicalUrl && isValidUrl(canonicalUrl)) return canonicalUrl;
            return `${this.siteUrl}${routePath}`;
        };

        // SEO-managed public pages
        let published = [];
        try {
            published = await this.seoRepository.listPublished();
        } catch (error) {
            logger.error('[SITEMAP_SEO_ERROR]', { errorMessage: error.message });
        }

        const noindexRoutes = new Set();
        for (const row of published) {
            const routePath = row.route_path;
            const robots = row.robots || 'index,follow';
            if (isNonIndexableRoute(routePath)) continue;
            if (String(robots).includes('noindex')) {
                noindexRoutes.add(routePath);
                continue;
            }
            const loc = resolveLoc(routePath, row.canonical_url);
            addUrl(loc, {
                lastmod: row.updated_at ? new Date(row.updated_at).toISOString() : null,
                changefreq: routePath === '/' ? 'daily' : 'weekly',
                priority: routePath === '/' ? 1.0 : 0.7,
            });
        }

        // Default public pages (ensure core pages present)
        const defaultRoutes = ['/', '/shop', '/collections', '/about'];
        for (const rp of defaultRoutes) {
            if (noindexRoutes.has(rp)) continue;
            const seoRow = published.find((r) => r.route_path === rp);
            if (seoRow && String(seoRow.robots || '').includes('noindex')) continue;
            const loc = resolveLoc(rp, seoRow ? seoRow.canonical_url : null);
            addUrl(loc, {
                lastmod: seoRow && seoRow.updated_at ? new Date(seoRow.updated_at).toISOString() : null,
                changefreq: rp === '/' ? 'daily' : 'weekly',
                priority: rp === '/' ? 1.0 : 0.6,
            });
        }

        // Products
        let products = [];
        try {
            products = await this.listProducts();
        } catch (error) {
            logger.error('[SITEMAP_PRODUCTS_ERROR]', { errorMessage: error.message });
        }

        for (const p of products) {
            const id = p && (p.id != null ? p.id : p);
            if (id == null) continue;
            // Use the canonical DB slug as the descriptive prefix. When no slug is
            // present, fall back to the numeric ID alone (no "-{id}" suffix) so the
            // sitemap URL matches the frontend links and prerendered routes.
            const slug = p.slug && String(p.slug).trim() ? String(p.slug) : null;
            const routePath = slug ? `/product/${slug}-${id}` : `/product/${id}`;
            if (noindexRoutes.has(routePath)) continue;
            // check if a product-specific SEO record exists (match by new descriptive
            // route path, legacy numeric route path, or product_id)
            const seoRow = published.find(
                (r) => r.route_path === routePath || r.route_path === `/product/${id}` || r.product_id === Number(id)
            );
            if (seoRow && String(seoRow.robots || '').includes('noindex')) continue;
            const loc = resolveLoc(routePath, seoRow ? seoRow.canonical_url : null);
            addUrl(loc, {
                lastmod: p.updated_at ? new Date(p.updated_at).toISOString() : (seoRow && seoRow.updated_at ? new Date(seoRow.updated_at).toISOString() : null),
                changefreq: 'weekly',
                priority: 0.8,
            });
        }

        return { urls: [...urls.values()] };
    }
}

export default GetSitemapUseCase;