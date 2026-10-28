import { logger } from '../../shared/logging/logger.js';

function createSeoController({
    seoRepository,
    getSeoSettingsUseCase,
    listSeoSettingsUseCase,
    createSeoSettingsUseCase,
    updateSeoSettingsUseCase,
    deleteSeoSettingsUseCase,
    getSitemapUseCase,
}) {
    return {
        // ── Public: metadata for a published public route ─────────────
        async getPublicSeo(req, res) {
            try {
                const { route } = req.params;
                const seo = await getSeoSettingsUseCase.execute(route);
                res.json(seo);
            } catch (error) {
                logger.error('[SEO_GET_PUBLIC_ERROR]', {
                    route: req.params.route,
                    errorMessage: error.message,
                });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational
                    ? error.message
                    : 'Failed to fetch SEO metadata';
                res.status(statusCode).json({ error: message });
            }
        },

        // ── Public: sitemap ───────────────────────────────────────────
        async getSitemap(req, res) {
            try {
                const sitemap = await getSitemapUseCase.execute();
                res.json(sitemap);
            } catch (error) {
                logger.error('[SEO_SITEMAP_ERROR]', { errorMessage: error.message });
                res.status(500).json({ error: 'Failed to build sitemap' });
            }
        },

        // ── Admin: list all SEO settings ──────────────────────────────
        async listSeoSettings(req, res) {
            try {
                const settings = await listSeoSettingsUseCase.execute();
                res.json(settings);
            } catch (error) {
                logger.error('[SEO_LIST_ERROR]', {
                    errorMessage: error.message,
                });
                const statusCode = error.statusCode || 500;
                res.status(statusCode).json({ error: 'Failed to list SEO settings' });
            }
        },

        // ── Admin: get a single SEO setting (full record) ─────────────
        async getSeoSetting(req, res) {
            try {
                const { route } = req.params;
                const seo = await seoRepository.getByRoute(route);
                if (!seo) {
                    return res.status(404).json({ error: 'SEO setting not found' });
                }
                res.json(seo);
            } catch (error) {
                logger.error('[SEO_GET_ADMIN_ERROR]', {
                    route: req.params.route,
                    errorMessage: error.message,
                });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to fetch SEO setting';
                res.status(statusCode).json({ error: message });
            }
        },

        // ── Admin: create an SEO setting ──────────────────────────────
        async createSeoSetting(req, res) {
            try {
                const created = await createSeoSettingsUseCase.execute(req.body);
                res.status(201).json(created);
            } catch (error) {
                logger.error('[SEO_CREATE_ERROR]', {
                    errorMessage: error.message,
                });
                const statusCode = error.statusCode || 400;
                const message = error.isOperational ? error.message : 'Failed to create SEO setting';
                res.status(statusCode).json({
                    error: message,
                    details: error.details || null,
                });
            }
        },

        // ── Admin: update an SEO setting ──────────────────────────────
        async updateSeoSetting(req, res) {
            try {
                const { route } = req.params;
                const updated = await updateSeoSettingsUseCase.execute(
                    route,
                    req.body
                );
                res.json(updated);
            } catch (error) {
                logger.error('[SEO_UPDATE_ERROR]', {
                    route: req.params.route,
                    errorMessage: error.message,
                });
                const statusCode = error.statusCode || 400;
                const message = error.isOperational ? error.message : 'Failed to update SEO setting';
                res.status(statusCode).json({
                    error: message,
                    details: error.details || null,
                });
            }
        },

        // ── Admin: delete an SEO setting ──────────────────────────────
        async deleteSeoSetting(req, res) {
            try {
                const { route } = req.params;
                const result = await deleteSeoSettingsUseCase.execute(route);
                res.json(result);
            } catch (error) {
                logger.error('[SEO_DELETE_ERROR]', {
                    route: req.params.route,
                    errorMessage: error.message,
                });
                const statusCode = error.statusCode || 400;
                const message = error.isOperational ? error.message : 'Failed to delete SEO setting';
                res.status(statusCode).json({ error: message });
            }
        },
    };
}

export { createSeoController };
