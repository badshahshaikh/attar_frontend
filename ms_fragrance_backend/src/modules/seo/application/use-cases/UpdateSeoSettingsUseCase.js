import { logger } from '../../../../shared/logging/logger.js';
import { validateSeoSettings } from '../validators/seo.validator.js';

/**
 * UpdateSeoSettingsUseCase - Admin-facing update of an SEO setting row.
 *
 * Responsibilities:
 * - Validate input (partial updates allowed).
 * - Enforce the unique route_path rule when the route is being changed.
 * - Return 404 when no row exists for the route_path.
 * - Return the updated full record.
 */
class UpdateSeoSettingsUseCase {
    constructor({ seoRepository }) {
        this.seoRepository = seoRepository;
    }

    async execute(routePath, data) {
        try {
            if (!routePath || typeof routePath !== 'string') {
                throw new Error('routePath is required');
            }

            const { normalized } = validateSeoSettings(data, { isUpdate: true });

            const existing = await this.seoRepository.getByRoute(routePath);
            if (!existing) {
                const error = new Error(
                    `No SEO setting found for route ${routePath}`
                );
                error.statusCode = 404;
                error.isOperational = true;
                throw error;
            }

            // If the route_path itself changed, ensure the new route is unique.
            if (
                normalized.route_path &&
                normalized.route_path !== routePath
            ) {
                const conflict = await this.seoRepository.getByRoute(
                    normalized.route_path
                );
                if (conflict) {
                    const error = new Error(
                        `An SEO setting already exists for route ${normalized.route_path}`
                    );
                    error.statusCode = 409;
                    error.isOperational = true;
                    throw error;
                }
            }

            const updateData = { ...normalized };
            if (updateData.route_path === routePath) {
                // Keep the route key stable; the WHERE clause uses it.
                delete updateData.route_path;
            }

            const updated = await this.seoRepository.updateByRoute(
                routePath,
                updateData
            );

            logger.info('[SEO_UPDATE_SETTINGS]', { route_path: routePath });
            return updated;
        } catch (error) {
            logger.error('[SEO_UPDATE_SETTINGS_ERROR]', {
                route_path: routePath,
                errorMessage: error.message,
            });
            throw error;
        }
    }
}

export default UpdateSeoSettingsUseCase;
