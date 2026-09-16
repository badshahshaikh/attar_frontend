/**
 * useProductFilters.js
 *
 * Manages filter state for product listing pages.
 * Owns: filters object, handleFilterChange, handlePriceChange, resetFilters.
 *
 * Does NOT own: search, URL params, API calls, debounce.
 * Those remain in Shop for cleaner separation of concerns.
 */

import { useState } from 'react';
import { DEFAULT_FILTERS } from '../config/constants';

/**
 * @returns {{
 *   filters: object,
 *   setFilters: function,
 *   handleFilterChange: function,
 *   handlePriceChange: function,
 *   resetFilters: function
 * }}
 */
export function useProductFilters() {
    const [filters, setFilters] = useState(DEFAULT_FILTERS);

    /**
     * Toggle an item in an array-type filter (categories, sizes, etc.).
     * Works for any array field in filters — future fields just work.
     *
     * @param {string} filterType - Key in filters object (e.g. 'categories', 'sizes').
     * @param {*} value - The item to add or remove.
     */
    function handleFilterChange(filterType, value) {
        setFilters(previous => {
            const currentValues = previous[filterType];

            // Boolean fields (inStockOnly) are passed directly
            if (typeof value === 'boolean') {
                return { ...previous, [filterType]: value };
            }

            // Array fields — toggle the value
            const existing = Array.isArray(currentValues) ? currentValues : [];
            const updatedValues = existing.includes(value)
                ? existing.filter(item => item !== value)
                : [...existing, value];

            return { ...previous, [filterType]: updatedValues };
        });
    }

    /**
     * Update min or max price, clamped so min <= max.
     *
     * @param {'minPrice'|'maxPrice'} type
     * @param {number} value
     */
    function handlePriceChange(type, value) {
        setFilters(prev => {
            if (type === 'minPrice') {
                return { ...prev, minPrice: Math.min(value, prev.maxPrice) };
            }
            if (type === 'maxPrice') {
                return { ...prev, maxPrice: Math.max(value, prev.minPrice) };
            }
            return prev;
        });
    }

    /**
     * Restore filters to the default state.
     * Consumers (Shop) are responsible for clearing URL params and search
     * because those are their own state responsibilities.
     */
    function resetFilters() {
        setFilters(DEFAULT_FILTERS);
    }

    return {
        filters,
        setFilters,
        handleFilterChange,
        handlePriceChange,
        resetFilters
    };
}
