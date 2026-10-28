import { logger } from '../../../../shared/logging/logger.js';

/**
 * DeleteSeoSettingsUseCase - Admin-facing deletion of an SEO setting row.
 *
 * Returns 404 when no row exists for the route_path.
 */
class DeleteSeoSettingsUseCase {
    constructor(seoRepository) {
        this.seoRepository = seoRepository;
    }

    async execute(routePath) {
        try {
            if (!routePath || typeof routePath !== 'string') {
                throw new Error('routePath is required');
            }

            const deleted = await this.seoRepository.deleteByRoute(routePath);
            if (!deleted) {
                const error = new Error(
                    `No SEO setting found for route ${routePath}`
                );
                error.statusCode = 404;
                error.isOperational = true;
                throw error;
            }

            logger.info('[SEO_DELETE_SETTINGS]', { route_path: routePath });
            return { message: 'SEO setting deleted', route_path: routePath };
        } catch (error) {
            logger.error('[SEO_DELETE_SETTINGS_ERROR]', {
                route_path: routePath,
                errorMessage: error.message,
            });
            throw error;
        }
    }
}

export default DeleteSeoSettingsUseCase;
