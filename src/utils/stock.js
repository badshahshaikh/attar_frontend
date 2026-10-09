/**
 * stock.js - Single source of truth for product availability.
 *
 * A product is sellable only when it is flagged in stock AND has a positive
 * integer quantity. Both signals are required because `inStock` can be stale
 * (left true by an admin edit) while the real quantity has reached zero.
 *
 * These helpers are intentionally defensive: quantities may arrive as numbers,
 * numeric strings (bulk edit / form inputs) or be missing/null, and an invalid
 * quantity must never be treated as available.
 */

/**
 * Coerce any stock quantity input into a safe non-negative integer.
 * Returns 0 for anything that is not a clean, non-negative integer
 * (null, undefined, NaN, negatives, floats, empty strings, junk text).
 *
 * @param {*} quantity
 * @returns {number} A non-negative integer, or 0 when the value is invalid.
 */
export function toStockQuantity(quantity) {
    if (quantity === null || quantity === undefined || quantity === '') {
        return 0;
    }

    const value = Number(quantity);

    if (!Number.isFinite(value) || value <= 0) {
        return 0;
    }

    return Math.floor(value);
}

/**
 * Determine whether a product is available for purchase.
 * Available only when inStock === true AND stockQuantity > 0.
 *
 * @param {{ inStock?: boolean, stockQuantity?: * }} product
 * @returns {boolean}
 */
export function isProductAvailable(product) {
    if (!product) return false;

    return product.inStock === true && toStockQuantity(product.stockQuantity) > 0;
}

/**
 * The maximum number of units a customer may select for a product.
 * Returns 0 when the product is unavailable.
 *
 * @param {{ inStock?: boolean, stockQuantity?: * }} product
 * @returns {number} Non-negative integer stock ceiling.
 */
export function getAvailableStock(product) {
    if (!isProductAvailable(product)) return 0;

    return toStockQuantity(product.stockQuantity);
}

/**
 * Clamp a requested quantity to what is actually in stock.
 * Never returns more than the available stock, and never less than 0.
 *
 * @param {*} requested
 * @param {{ inStock?: boolean, stockQuantity?: * }} product
 * @returns {number}
 */
export function clampQuantity(requested, product) {
    const max = getAvailableStock(product);
    const value = Math.floor(Number(requested));

    if (!Number.isFinite(value) || value < 0) {
        return 0;
    }

    return Math.min(value, max);
}
