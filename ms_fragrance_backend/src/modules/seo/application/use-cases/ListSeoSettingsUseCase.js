import { logger } from '../../../../shared/logging/logger.js';

/**
 * ListSeoSettingsUseCase - Admin-facing list of all SEO settings.
 *
 * Returns full records (including internal fields) for the admin UI.
 */
class ListSeoSettingsUseCase {
    constructor(seoRepository) {
        this.seoRepository = seoRepository;
    }

    async execute() {
        try {
            const rows = await this.seoRepository.getAll();
            logger.info('[SEO_LIST_SETTINGS]', { count: rows.length });
            return rows;
        } catch (error) {
            logger.error('[SEO_LIST_SETTINGS_ERROR]', {
                errorMessage: error.message,
            });
            throw error;
        }
    }
}

export default ListSeoSettingsUseCase;
