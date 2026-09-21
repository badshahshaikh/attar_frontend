import { logger } from '../../../../shared/logging/logger.js';
import { getDefaultFooterSettings } from '../validators/FooterSettingsValidator.js';

/**
 * GetFooterSettingsUseCase - Business logic for retrieving footer settings
 * 
 * Responsibilities:
 * - Fetch settings from repository
 * - Provide default settings if none exist
 * - Handle domain-specific logic
 * 
 * This use case is testable with a mocked repository.
 */

class GetFooterSettingsUseCase {
    constructor(settingsRepository) {
        this.settingsRepository = settingsRepository;
    }

    async execute() {
        try {
            const settings = await this.settingsRepository.getByKey('footer');
            
            if (!settings) {
                logger.info('[GET_FOOTER_SETTINGS] No settings found, returning defaults');
                return getDefaultFooterSettings();
            }

            return settings;
        } catch (error) {
            logger.error('[GET_FOOTER_SETTINGS_ERROR]', { errorMessage: error.message });
            throw error;
        }
    }
}

export default GetFooterSettingsUseCase;
