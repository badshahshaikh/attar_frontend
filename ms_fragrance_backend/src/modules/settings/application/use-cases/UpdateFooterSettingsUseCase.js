import { logger } from '../../../../shared/logging/logger.js';
import { validateFooterSettings } from '../validators/FooterSettingsValidator.js';

/**
 * UpdateFooterSettingsUseCase - Business logic for updating footer settings
 * 
 * Responsibilities:
 * - Validate input data
 * - Delegate persistence to repository
 * - Handle domain-specific logic
 * 
 * This use case is testable with a mocked repository.
 */

class UpdateFooterSettingsUseCase {
    constructor(settingsRepository) {
        this.settingsRepository = settingsRepository;
    }

    async execute(settings) {
        try {
            // Validate settings before persisting
            validateFooterSettings(settings);

            // Persist to repository
            const updatedSettings = await this.settingsRepository.upsert('footer', settings);

            logger.info('[UPDATE_FOOTER_SETTINGS] Settings updated successfully');
            
            return updatedSettings;
        } catch (error) {
            logger.error('[UPDATE_FOOTER_SETTINGS_ERROR]', { errorMessage: error.message });
            throw error;
        }
    }
}

export default UpdateFooterSettingsUseCase;
