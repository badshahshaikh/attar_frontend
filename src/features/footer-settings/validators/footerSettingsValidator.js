/**
 * footerSettingsValidator.js - Validation utilities for footer settings
 * 
 * Pure functions for validating footer settings data.
 * Reusable and testable without dependencies.
 */

/**
 * Validate email format
 */
export function isValidEmail(email) {
    if (!email) return true; // Optional field
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate phone format (allows digits, spaces, +, -, parentheses)
 */
export function isValidPhone(phone) {
    if (!phone) return true; // Optional field
    return /^[\d\s+()-]+$/.test(phone);
}

/**
 * Validate URL format
 */
export function isValidUrl(url) {
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
 * @returns {Array} Array of error messages (empty if valid)
 */
export function validateFooterSettings(settings) {
    const errors = [];

    if (!settings || typeof settings !== 'object') {
        return ['Invalid settings format: must be an object'];
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

    return errors;
}
