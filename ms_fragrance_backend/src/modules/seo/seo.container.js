import { createSeoRepository } from './seo.repository.js';
import GetSeoSettingsUseCase from './application/use-cases/GetSeoSettingsUseCase.js';
import GetSitemapUseCase from './application/use-cases/GetSitemapUseCase.js';
import ListSeoSettingsUseCase from './application/use-cases/ListSeoSettingsUseCase.js';
import CreateSeoSettingsUseCase from './application/use-cases/CreateSeoSettingsUseCase.js';
import UpdateSeoSettingsUseCase from './application/use-cases/UpdateSeoSettingsUseCase.js';
import DeleteSeoSettingsUseCase from './application/use-cases/DeleteSeoSettingsUseCase.js';
import { createSeoController } from './seo.controller.js';
import { logger } from '../../shared/logging/logger.js';
import { createSeoRouter } from './seo.routes.js';

/**
 * SeoContainer - Dependency injection container for the SEO module.
 *
 * Dependency flow:
 *   Database
 *     ↓
 *   SeoRepository
 *     ↓
 *   Use Cases (Get/List/Create/Update/Delete)
 *     ↓
 *   SeoController
 *     ↓
 *   SeoRouter
 */
import databaseModule from '../../infrastructure/database/postgres-database.js';

function createSeoContainer(dependencies = {}) {
    const database = dependencies.database || databaseModule;

    const query = dependencies.query || database.query;

    // Repository layer
    const seoRepository = createSeoRepository({ query });

    // Lightweight product fetcher for deriving product-default SEO metadata.
    // Queries the products table directly to avoid coupling to the products
    // module and any circular dependency risk.
    async function getProductById(productId) {
        try {
            const result = await query(
                `SELECT id, name, description, full_description, price,
                        image_url, image_urls, in_stock, slug
                 FROM products WHERE id = $1`,
                [productId]
            );
            if (result.rows.length === 0) return null;
            const row = result.rows[0];
            return {
                ...row,
                image_url:
                    row.image_url ||
                    (Array.isArray(row.image_urls) && row.image_urls[0]),
            };
        } catch (error) {
            logger.error('[SEO_GET_PRODUCT_BY_ID_ERROR]', {
                product_id: productId,
                errorMessage: error.message,
            });
            return null;
        }
    }

    async function listProducts() {
        try {
            const result = await query('SELECT id, updated_at FROM products');
            return result.rows;
        } catch (error) {
            logger.error('[SEO_LIST_PRODUCTS_ERROR]', { errorMessage: error.message });
            return [];
        }
    }

    // Application layer (use cases)
    const getSeoSettingsUseCase = new GetSeoSettingsUseCase({
        seoRepository,
        getProductById,
    });
    const getSitemapUseCase = new GetSitemapUseCase({
        seoRepository,
        listProducts,
        siteUrl: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://attar-frontend-tau.vercel.app' : 'http://localhost:5173'),
    });
    const listSeoSettingsUseCase = new ListSeoSettingsUseCase(seoRepository);
    const createSeoSettingsUseCase = new CreateSeoSettingsUseCase({
        seoRepository,
    });
    const updateSeoSettingsUseCase = new UpdateSeoSettingsUseCase({
        seoRepository,
    });
    const deleteSeoSettingsUseCase = new DeleteSeoSettingsUseCase(seoRepository);

    // Presentation layer
    const seoController = createSeoController({
        seoRepository,
        getSeoSettingsUseCase,
        listSeoSettingsUseCase,
        createSeoSettingsUseCase,
        updateSeoSettingsUseCase,
        deleteSeoSettingsUseCase,
        getSitemapUseCase,
    });

    const seoRouter = createSeoRouter(seoController);

    return Object.freeze({
        seoRouter,
        seoRepository,
        getSeoSettingsUseCase,
        getSitemapUseCase,
        listSeoSettingsUseCase,
        createSeoSettingsUseCase,
        updateSeoSettingsUseCase,
        deleteSeoSettingsUseCase,
    });
}

export { createSeoContainer };
