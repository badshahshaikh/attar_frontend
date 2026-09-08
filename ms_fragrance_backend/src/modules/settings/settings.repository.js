const { logger } = require('../../shared/logging/logger');

function createSettingsRepository({ query }) {
    return {
        async getByKey(key) {
            try {
                const result = await query(
                    'SELECT setting_value FROM website_settings WHERE setting_key = $1',
                    [key]
                );
                if (result.rows.length === 0) {
                    return null;
                }
                return result.rows[0].setting_value;
            } catch (error) {
                logger.error('[SETTINGS_GET_ERROR]', { key, errorMessage: error.message });
                throw error;
            }
        },

        async upsert(key, value) {
            try {
                const result = await query(
                    `INSERT INTO website_settings (setting_key, setting_value, updated_at)
                     VALUES ($1, $2, NOW())
                     ON CONFLICT (setting_key)
                     DO UPDATE SET setting_value = $2, updated_at = NOW()
                     RETURNING setting_value`,
                    [key, value]
                );
                return result.rows[0].setting_value;
            } catch (error) {
                logger.error('[SETTINGS_UPSERT_ERROR]', { key, errorMessage: error.message });
                throw error;
            }
        }
    };
}

module.exports = { createSettingsRepository };
