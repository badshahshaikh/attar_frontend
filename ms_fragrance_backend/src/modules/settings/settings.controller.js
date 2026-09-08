const { logger } = require('../../shared/logging/logger');

function createSettingsController({ settingsService }) {
    return {
        async getFooterSettings(req, res) {
            try {
                const settings = await settingsService.getFooterSettings();
                res.json(settings);
            } catch (error) {
                logger.error('[SETTINGS_GET_FOOTER_ERROR]', { errorMessage: error.message });
                res.status(500).json({ error: 'Failed to fetch footer settings' });
            }
        },

        async updateFooterSettings(req, res) {
            try {
                const settings = await settingsService.updateFooterSettings(req.body);
                res.json(settings);
            } catch (error) {
                logger.error('[SETTINGS_UPDATE_FOOTER_ERROR]', { errorMessage: error.message });
                res.status(500).json({ error: error.message || 'Failed to update footer settings' });
            }
        }
    };
}

module.exports = { createSettingsController };
