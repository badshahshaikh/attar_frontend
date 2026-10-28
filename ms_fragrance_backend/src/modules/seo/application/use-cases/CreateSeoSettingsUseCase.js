import { logger } from '../../../../shared/logging/logger.js';
import { validateSeoSettings } from '../validators/seo.validator.js';

/**
 * CreateSeoSettingsUseCase - Admin-facing creation of an SEO setting row.
 *
 * Responsibilities:
 * - Validate input (route format, field lengths, URLs, robots, etc.).
 * - Enforce the unique route_path rule.
 * - Persist the new row and return the full record.
 */
class CreateSeoSettingsUseCase {
    constructor({ seoRepository }) {
        this.seoRepository = seoRepository;
    }

    async execute(data) {
        try {
            const { normalized } = validateSeoSettings(data);

            const existing = await this.seoRepository.getByRoute(
                normalized.route_path
            );
            if (existing) {
                const error = new Error(
                    `An SEO setting already exists for route ${normalized.route_path}`
                );
                error.statusCode = 409;
                error.isOperational = true;
                throw error;
            }

            const created = await this.seoRepository.insert(normalized);

            logger.info('[SEO_CREATE_SETTINGS]', {
                route_path: normalized.route_path,
            });
            return created;
        } catch (error) {
            logger.error('[SEO_CREATE_SETTINGS_ERROR]', {
                route_path: data && data.route_path,
                errorMessage: error.message,
            });
            throw error;
        }
    }
}

export default CreateSeoSettingsUseCase;
