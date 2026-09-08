const ValidationError = require('../../../../core/errors/ValidationError');

/**
 * FooterSettingsValidator - Validation logic for footer settings
 * 
 * Pure functions for validating footer settings data.
 * Reusable and testable without dependencies.
 */

const DEFAULT_FOOTER_SETTINGS = {
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

/**
 * Validate email format
 */
function isValidEmail(email) {
    if (!email) return true; // Optional field
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate phone format (allows digits, spaces, +, -, parentheses)
 */
function isValidPhone(phone) {
    if (!phone) return true; // Optional field
    return /^[\d\s+()-]+$/.test(phone);
}

/**
 * Validate URL format
 */
function isValidUrl(url) {
    if (!url) return true; // Optional field
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate footer settings object
 * @param {Object} settings - Footer settings to validate
 * @throws {ValidationError} If validation fails
 */
function validateFooterSettings(settings) {
    const errors = [];

    if (!settings || typeof settings !== 'object') {
        throw new ValidationError('Invalid settings format: must be an object');
    }

    // Validate brand name (required)
    if (!settings.brand?.name?.trim()) {
        errors.push('Brand name is required');
    }

    // Validate contact email
    if (settings.contact?.email && !isValidEmail(settings.contact.email)) {
        errors.push('Invalid email format');
    }

    // Validate contact phone
    if (settings.contact?.phone && !isValidPhone(settings.contact.phone)) {
        errors.push('Invalid phone format');
    }

    // Validate contact whatsapp
    if (settings.contact?.whatsapp && !isValidPhone(settings.contact.whatsapp)) {
        errors.push('Invalid WhatsApp format');
    }

    // Validate social media URLs
    const urlFields = ['instagram', 'facebook', 'youtube', 'twitter'];
    urlFields.forEach(field => {
        const url = settings.socialMedia?.[field];
        if (url && !isValidUrl(url)) {
            errors.push(`Invalid ${field} URL format`);
        }
    });

    if (errors.length > 0) {
        throw new ValidationError('Validation failed', errors);
    }

    return true;
}

/**
 * Get default footer settings
 */
function getDefaultFooterSettings() {
    return JSON.parse(JSON.stringify(DEFAULT_FOOTER_SETTINGS));
}

module.exports = {
    validateFooterSettings,
    getDefaultFooterSettings,
    isValidEmail,
    isValidPhone,
    isValidUrl
};
