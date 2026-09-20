const { logger } = require('../../shared/logging/logger');
const AppError = require('../../core/errors/AppError');

function createSettingsController({ getFooterSettingsUseCase, updateFooterSettingsUseCase }) {
    return {
        async getFooterSettings(req, res) {
            try {
                const settings = await getFooterSettingsUseCase.execute();
                res.json(settings);
            } catch (error) {
                logger.error('[SETTINGS_GET_FOOTER_ERROR]', { errorMessage: error.message });

                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to fetch footer settings';

                res.status(statusCode).json({ error: message });
            }
        },

        async updateFooterSettings(req, res) {
            try {
                const settings = await updateFooterSettingsUseCase.execute(req.body);
                res.json(settings);
            } catch (error) {
                logger.error('[SETTINGS_UPDATE_FOOTER_ERROR]', { errorMessage: error.message });

                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to update footer settings';

                res.status(statusCode).json({
                    error: message,
                    details: error.details || null
                });
            }
        }
    };
}

export { createSettingsController };