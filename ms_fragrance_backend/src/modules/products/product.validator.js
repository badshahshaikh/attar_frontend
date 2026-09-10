const ValidationError = require('../../core/errors/ValidationError');

/**
 * ProductValidator - Validation and normalization for product data
 * 
 * Pure functions for validating and normalizing product data.
 * Reusable and testable without dependencies.
 */

function parseBoolean(value, fieldName) {
    if (value === undefined) return undefined;
    if (value === true || value === false) return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    throw new Error(`${fieldName} must be a boolean`);
}

/**
 * Validate and normalize product payload
 * @param {Object} body - Raw product data from request
 * @returns {Object} Normalized product payload
 * @throws {ValidationError} If validation fails
 */
function parseProductPayload(body) {
    const payload = { ...body, fragranceType: body.fragranceType || body.fragranceFamily };
    
    // Required fields
    if (!payload.name || !String(payload.name).trim()) {
        throw new ValidationError('Product name is required');
    }
    if (payload.price === undefined || payload.price === '' || !Number.isFinite(Number(payload.price)) || Number(payload.price) < 0) {
        throw new ValidationError('Price must be a non-negative number');
    }
    if (!payload.brand || !String(payload.brand).trim()) {
        throw new ValidationError('Brand is required');
    }
    if (!payload.fragranceType || !String(payload.fragranceType).trim()) {
        throw new ValidationError('Fragrance family is required');
    }
    
    // Array fields
    for (const field of ['sizes', 'topNotes', 'heartNotes', 'baseNotes']) {
        if (payload[field] !== undefined && !Array.isArray(payload[field])) {
            throw new ValidationError(`${field} must be an array`);
        }
    }
    
    // Object fields
    if (payload.sizePricing !== undefined && (typeof payload.sizePricing !== 'object' || Array.isArray(payload.sizePricing) || payload.sizePricing === null)) {
        throw new ValidationError('sizePricing must be an object');
    }
    
    // Boolean fields
    for (const field of ['inStock', 'isNew', 'isBestSeller', 'isExclusive', 'featured']) {
        payload[field] = parseBoolean(payload[field], field);
    }
    
    // Numeric fields
    if (payload.stockQuantity !== undefined && (!Number.isInteger(Number(payload.stockQuantity)) || Number(payload.stockQuantity) < 0)) {
        throw new ValidationError('Stock quantity must be a non-negative integer');
    }
    
    // Rating validation
    if (payload.rating !== undefined && payload.rating !== '' && (!Number.isFinite(Number(payload.rating)) || Number(payload.rating) < 0 || Number(payload.rating) > 5)) {
        throw new ValidationError('Rating must be between 0 and 5');
    }
    
    // Reviews validation
    if (payload.reviews !== undefined && payload.reviews !== '' && (!Number.isInteger(Number(payload.reviews)) || Number(payload.reviews) < 0)) {
        throw new ValidationError('Reviews must be a non-negative integer');
    }
    
    // Normalize numeric fields
    payload.price = Number(payload.price);
    if (payload.originalPrice !== undefined && payload.originalPrice !== null && payload.originalPrice !== '') {
        if (!Number.isFinite(Number(payload.originalPrice)) || Number(payload.originalPrice) < 0) {
            throw new ValidationError('Original price must be a non-negative number');
        }
        payload.originalPrice = Number(payload.originalPrice);
    }
    
    if (payload.rating !== undefined && payload.rating !== '') {
        payload.rating = Number(payload.rating);
    }
    
    if (payload.reviews !== undefined && payload.reviews !== '') {
        payload.reviews = Number(payload.reviews);
    }
    
    if (payload.stockQuantity !== undefined) {
        payload.stockQuantity = Number(payload.stockQuantity);
    }
    
    return payload;
}

/**
 * Validate product ID parameter
 * @param {string|number} rawId - Raw ID from request params
 * @returns {number|null} Validated ID or null if invalid
 */
function parseProductIdParam(rawId) {
    if (!/^\d+$/.test(String(rawId)) || Number(rawId) <= 0) return null;
    return Number(rawId);
}

/**
 * Parse and validate list query parameters
 * @param {Object} query - Query parameters from request
 * @returns {Object} Normalized query parameters
 */
function parseListQuery(query) {
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 50));
    
    return {
        page,
        limit,
        search: query.search,
        brand: query.brand,
        fragranceFamily: query.fragranceFamily,
        category: query.category,
        isBestSeller: query.isBestSeller === undefined ? undefined : parseBoolean(query.isBestSeller, 'isBestSeller'),
        isExclusive: query.isExclusive === undefined ? undefined : parseBoolean(query.isExclusive, 'isExclusive'),
        featured: query.featured === undefined ? undefined : parseBoolean(query.featured, 'featured')
    };
}

/**
 * Normalize size pricing and ensure consistency
 * @param {Object} sizePricing - Size pricing object
 * @param {Array} sizes - Available sizes array
 * @returns {Object} Normalized size pricing
 */
function normalizeSizePricing(sizePricing, sizes = []) {
    if (!sizePricing || typeof sizePricing !== 'object') {
        return {};
    }
    
    const normalized = {};
    
    // Ensure all keys in sizePricing have valid numeric values
    for (const [size, price] of Object.entries(sizePricing)) {
        const numPrice = Number(price);
        if (!isNaN(numPrice) && numPrice >= 0) {
            normalized[size] = numPrice;
        }
    }
    
    // If sizes array is provided, ensure sizePricing only contains sizes from that array
    if (Array.isArray(sizes) && sizes.length > 0) {
        const validSizes = new Set(sizes);
        const filtered = {};
        for (const [size, price] of Object.entries(normalized)) {
            if (validSizes.has(size)) {
                filtered[size] = price;
            }
        }
        return filtered;
    }
    
    return normalized;
}

/**
 * Derive sizes from size pricing
 * @param {Object} sizePricing - Size pricing object
 * @returns {Array} Array of size keys
 */
function deriveSizesFromPricing(sizePricing) {
    if (!sizePricing || typeof sizePricing !== 'object') {
        return [];
    }
    return Object.keys(sizePricing).filter(size => {
        const price = sizePricing[size];
        return price !== undefined && price !== null && price !== '' && !isNaN(Number(price));
    });
}

/**
 * Ensure size pricing and sizes are consistent
 * @param {Object} product - Product object
 * @returns {Object} Product with consistent size pricing and sizes
 */
function ensureSizeConsistency(product) {
    const normalized = { ...product };
    
    // Normalize size pricing
    normalized.sizePricing = normalizeSizePricing(product.sizePricing, product.sizes);
    
    // If sizes is empty or undefined, derive from sizePricing
    if (!normalized.sizes || normalized.sizes.length === 0) {
        normalized.sizes = deriveSizesFromPricing(normalized.sizePricing);
    }
    
    // If sizePricing is empty but sizes exist, create empty pricing
    if (Object.keys(normalized.sizePricing).length === 0 && normalized.sizes && normalized.sizes.length > 0) {
        normalized.sizePricing = {};
        normalized.sizes.forEach(size => {
            normalized.sizePricing[size] = 0;
        });
    }
    
    return normalized;
}

module.exports = {
    parseBoolean,
    parseProductPayload,
    parseProductIdParam,
    parseListQuery,
    normalizeSizePricing,
    deriveSizesFromPricing,
    ensureSizeConsistency
};
