/**
 * filterUtils.js
 *
 * Pure utility functions for product filter logic.
 * No React, no API calls, no side effects.
 */

/**
 * Sort an array of size strings numerically (e.g. 3ml < 6ml < 12ml < 50ml < 100ml).
 * Falls back to locale-aware string comparison for non-numeric values.
 * Safely handles null, undefined, and empty-string elements.
 *
 * @param {string[]} sizes
 * @returns {string[]}
 */
export function sortSizes(sizes = []) {
    const uniqueSizes = [
        ...new Set(
            sizes
                .filter(Boolean)
                .map(size => String(size).trim())
        )
    ];

    return uniqueSizes.sort((a, b) => {
        const sizeA = parseFloat(a);
        const sizeB = parseFloat(b);

        if (
            Number.isFinite(sizeA) &&
            Number.isFinite(sizeB)
        ) {
            return sizeA - sizeB;
        }

        return a.localeCompare(b);
    });
}
