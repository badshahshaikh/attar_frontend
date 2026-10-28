/**
 * seoService.js — API service for SEO settings
 *
 * Handles all SEO settings API communication with the backend.
 * Uses environment variable for API URL configuration.
 */

import { API_URL } from '../config/api';

async function parseResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error || data.message || 'The request could not be completed.');
        error.status = response.status;
        error.details = data.details || null;
        throw error;
    }
    return data;
}

function encodeRoute(route) {
    return encodeURIComponent(route);
}

/**
 * List all SEO settings (admin)
 */
export async function listSeoSettings() {
    const response = await fetch(`${API_URL}/api/seo`, { credentials: 'include' });
    return parseResponse(response);
}

/**
 * Get a single SEO setting by route (admin)
 */
export async function getSeoSetting(route) {
    const response = await fetch(`${API_URL}/api/seo/${encodeRoute(route)}`, { credentials: 'include' });
    return parseResponse(response);
}

/**
 * Create a new SEO setting (admin)
 */
export async function createSeoSetting(payload) {
    const response = await fetch(`${API_URL}/api/seo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
    });
    return parseResponse(response);
}

/**
 * Update an SEO setting by route (admin)
 */
export async function updateSeoSetting(route, payload) {
    const response = await fetch(`${API_URL}/api/seo/${encodeRoute(route)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
    });
    return parseResponse(response);
}

/**
 * Delete an SEO setting by route (admin)
 */
export async function deleteSeoSetting(route) {
    const response = await fetch(`${API_URL}/api/seo/${encodeRoute(route)}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    return parseResponse(response);
}

/**
 * Fetch public SEO metadata for a route (no auth)
 */
export async function getPublicSeo(route) {
    const response = await fetch(`${API_URL}/api/seo/public/${encodeRoute(route)}`);
    return parseResponse(response);
}
/**
 * Fetch the public sitemap data (no auth)
 */
export async function getPublicSitemap() {
    const response = await fetch(`${API_URL}/api/seo/public/sitemap`);
    return parseResponse(response);
}