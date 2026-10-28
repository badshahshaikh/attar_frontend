import { logger } from '../../../../shared/logging/logger.js';

const SITE = {
    name: 'MS Fragrance',
    url: 'https://msfragrance.in',
    title: 'MS Fragrance — Pure Attars & Natural Fragrances',
    desc: 'Pure attars and natural fragrances.',
    robots: 'index,follow',
    card: 'summary_large_image',
};

function truncate(text, max) {
    if (!text) return '';
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const sp = cut.lastIndexOf(' ');
    return sp > 0 ? cut.slice(0, sp) : cut;
}

function canonicalFor(p) {
    try {
        return new URL(p, SITE.url).href;
    } catch {
        return SITE.url + p;
    }
}

class GetSeoSettingsUseCase {
    constructor({ seoRepository, getProductById }) {
        this.seoRepository = seoRepository;
        this.getProductById = getProductById;
    }

    async execute(routePath) {
        try {
            if (!routePath || typeof routePath !== 'string') {
                throw new Error('routePath is required');
            }
            const path = routePath.startsWith('/') ? routePath : `/${routePath}`;
            let record = await this.seoRepository.getPublicByRoute(path);
            let product = null;

            const m = path.match(/^\/product\/(\d+)$/);
            if (!record && m) {
                const id = Number(m[1]);
                const pr = await this.seoRepository.getByProductId(id);
                if (pr) {
                    record = {
                        page_type: pr.page_type,
                        route_path: path,
                        seo_title: pr.seo_title,
                        meta_description: pr.meta_description,
                        canonical_url: pr.canonical_url,
                        robots: pr.robots,
                        og_title: pr.og_title,
                        og_description: pr.og_description,
                        og_image: pr.og_image,
                        twitter_card: pr.twitter_card,
                        twitter_title: pr.twitter_title,
                        twitter_description: pr.twitter_description,
                        twitter_image: pr.twitter_image,
                        structured_data: pr.structured_data,
                    };
                }
                if (this.getProductById) product = await this.getProductById(id);
            }

            const defaults = this.buildDefaults(path, product);
            return {
                page_type: record?.page_type || defaults.page_type,
                route_path: path,
                seo_title: record?.seo_title || defaults.seo_title,
                meta_description: record?.meta_description || defaults.meta_description,
                canonical_url: record?.canonical_url || defaults.canonical_url,
                robots: record?.robots || defaults.robots,
                og_title: record?.og_title || defaults.og_title,
                og_description: record?.og_description || defaults.og_description,
                og_image: record?.og_image || defaults.og_image,
                twitter_card: record?.twitter_card || defaults.twitter_card,
                twitter_title: record?.twitter_title || defaults.twitter_title,
                twitter_description: record?.twitter_description || defaults.twitter_description,
                twitter_image: record?.twitter_image || defaults.twitter_image,
                structured_data: record?.structured_data || defaults.structured_data,
            };
        } catch (error) {
            logger.error('[SEO_GET_SETTINGS_ERROR]', {
                route_path: routePath,
                errorMessage: error.message,
            });
            throw error;
        }
    }

    buildDefaults(path, product) {
        const url = canonicalFor(path);
        if (product) {
            const name = product.name || 'Product';
            const desc = product.description || product.full_description || '';
            return {
                page_type: 'product',
                seo_title: `${name} | ${SITE.name}`,
                meta_description: truncate(desc, 160) || SITE.desc,
                canonical_url: product.canonical_url || url,
                robots: SITE.robots,
                og_title: name,
                og_description: truncate(desc, 160) || SITE.desc,
                og_image: product.image_url || '',
                twitter_card: SITE.card,
                twitter_title: name,
                twitter_description: truncate(desc, 160) || SITE.desc,
                twitter_image: product.image_url || '',
                structured_data: this.productJsonLd(product, url),
            };
        }
        const ROUTE_TITLES = {
  '/': SITE.title,
  '/shop': `Shop | ${SITE.name}`,
  '/collections': `Collections | ${SITE.name}`,
  '/about': `About | ${SITE.name}`,
};
const baseTitle = ROUTE_TITLES[path] || SITE.title;
const pageType =
  path === '/' ? 'homepage' :
  path === '/shop' ? 'shop' :
  path === '/collections' ? 'collection' :
  path === '/about' ? 'about' : 'shop';
return {
  page_type: pageType,
  seo_title: baseTitle,
  meta_description: SITE.desc,
  canonical_url: url,
  robots: SITE.robots,
  og_title: baseTitle,
  og_description: SITE.desc,
  og_image: '',
  twitter_card: SITE.card,
  twitter_title: baseTitle,
  twitter_description: SITE.desc,
  twitter_image: '',
  structured_data: {},
};
    }

    productJsonLd(product, url) {
        const data = {
            '@context': 'https://schema.org/',
            '@type': 'Product',
            name: product.name || '',
            url,
        };
        if (product.description) data.description = product.description;
        const image = product.image_url || product.imageUrl;
        if (image) {
            data.image = image.startsWith('http')
                ? image
                : new URL(image, SITE.url).href;
        }
        if (product.price !== undefined && product.price !== null) {
            data.offers = {
                '@type': 'Offer',
                price: String(product.price),
                priceCurrency: 'INR',
            };
            if (product.in_stock !== undefined) {
                data.offers.availability = product.in_stock
                    ? 'https://schema.org/InStock'
                    : 'https://schema.org/OutOfStock';
            }
        }
        return data;
    }
}

export default GetSeoSettingsUseCase;
