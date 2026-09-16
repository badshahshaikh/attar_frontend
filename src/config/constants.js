// src/config/constants.js
export const WHATSAPP_NUMBER = "917977185230"; // Enter the number without +, spaces, or brackets.
export const WHATSAPP_DISPLAY = "+91 79771 85230";

// ── Shop / Filter ───────────────────────────────────────────────────────────

/** Default debounce delay (ms) for the product search input */
export const SEARCH_DEBOUNCE_DELAY = 400;

/** Default debounce delay (ms) for price-range changes */
export const PRICE_DEBOUNCE_DELAY = 500;

/** Default price boundaries used by the price-range filter */
export const DEFAULT_MIN_PRICE = 0;
export const DEFAULT_MAX_PRICE = 10000;

/**
 * Default filter state for useProductFilters.
 * Add new filter fields here as the product catalogue grows.
 */
export const DEFAULT_FILTERS = {
    categories: [],
    minPrice: DEFAULT_MIN_PRICE,
    maxPrice: DEFAULT_MAX_PRICE,
    sizes: [],
    inStockOnly: false
};
