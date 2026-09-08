const { logger } = require('../../shared/logging/logger');

function createSettingsService({ settingsRepository }) {
    return {
        async getFooterSettings() {
            try {
                const settings = await settingsRepository.getByKey('footer');
                if (!settings) {
                    // Return default settings if none exist
                    return {
                        brand: {
                            name: 'MS Fragrance',
                            description: 'The art of pure, non-alcoholic perfumery. We source the finest natural ingredients to craft timeless fragrance experiences for the modern connoisseur.',
                            logo: ''
                        },
                        contact: {
                            email: 'hello@rooh-attars.com',
                            phone: '+91 98765 43210',
                            whatsapp: '+91 98765 43210',
                            address: 'Mumbai, India'
                        },
                        socialMedia: {
                            instagram: '',
                            facebook: '',
                            youtube: '',
                            twitter: ''
                        },
                        links: {
                            shop: true,
                            about: true,
                            collections: true,
                            contact: true
                        },
                        newsletter: {
                            enabled: true,
                            title: 'Stay Updated',
                            description: 'Subscribe to receive updates and exclusive offers.'
                        },
                        copyright: {
                            text: '© 2026 MS Fragrance. All rights reserved.'
                        }
                    };
                }
                return settings;
            } catch (error) {
                logger.error('[SETTINGS_SERVICE_GET_ERROR]', { errorMessage: error.message });
                throw error;
            }
        },

        async updateFooterSettings(settings) {
            try {
                // Validate basic structure
                if (!settings || typeof settings !== 'object') {
                    throw new Error('Invalid settings format');
                }

                return await settingsRepository.upsert('footer', settings);
            } catch (error) {
                logger.error('[SETTINGS_SERVICE_UPDATE_ERROR]', { errorMessage: error.message });
                throw error;
            }
        }
    };
}

module.exports = { createSettingsService };
