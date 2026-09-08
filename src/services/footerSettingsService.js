/**
 * footerSettingsService.js — API service for footer settings
 *
 * Handles all footer settings API communication with the backend.
 * Uses environment variable for API URL configuration.
 */

import { API_URL } from '../config/api';

async function parseResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error || data.message || 'The request could not be completed.');
        error.status = response.status;
        throw error;
    }
    return data;
}

/**
 * Fetch footer settings from the backend API
 */
export async function getFooterSettings() {
    try {
        const response = await fetch(`${API_URL}/api/settings/footer`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching footer settings:', error);
        throw error;
    }
}

/**
 * Update footer settings
 */
export async function updateFooterSettings(settings) {
    const response = await fetch(`${API_URL}/api/settings/footer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
    });
    return parseResponse(response);
}
