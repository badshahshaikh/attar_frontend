import ValidationError from '../../core/errors/ValidationError.js';

import {
    requireText,
    validateArrayFields,
    validateObjectField,
    parseBoolean,
    validateNonNegativeNumber,
    validateNonNegativeInteger,
    validateRange
} from '../../core/validation/validation.helpers.js';


/**
 * Validate and normalize product payload
 * @param {Object} body - Raw product data from request
 * @returns {Object} Normalized product payload
 * @throws {ValidationError} If validation fails
 */
export function parseProductPayload(body) {
    const payload = {
        ...body,
        fragranceType:
            body.fragranceType ||
            body.fragranceFamily
    };

    // Required fields
    payload.name = requireText(
        payload.name,
        'Product name'
    );

    payload.brand = requireText(
        payload.brand,
        'Brand'
    );

    payload.fragranceType = requireText(
        payload.fragranceType,
        'Fragrance family'
    );

    // Price
    payload.price = validateNonNegativeNumber(
        payload.price,
        'Price',
        { required: true }
    );

    // Array fields
    validateArrayFields(
        payload,
        [
            'sizes',
            'topNotes',
            'heartNotes',
            'baseNotes',
            'imageUrls'
        ]
    );

    // Object fields
    validateObjectField(
        payload,
        'sizePricing',
        'sizePricing must be an object'
    );

    // Boolean fields
    for (const field of [
        'inStock',
        'isNew',
        'isBestSeller',
        'isExclusive',
        'featured'
    ]) {
        payload[field] = parseBoolean(
            payload[field],
            field
        );
    }

    // Stock quantity
    if (payload.stockQuantity !== undefined) {
        payload.stockQuantity =
            validateNonNegativeInteger(
                payload.stockQuantity,
                'Stock quantity'
            );
    }

    // Original price
    if (
        payload.originalPrice !== undefined &&
        payload.originalPrice !== null &&
        payload.originalPrice !== ''
    ) {
        payload.originalPrice =
            validateNonNegativeNumber(
                payload.originalPrice,
                'Original price'
            );
    }

    // Rating
    if (
        payload.rating !== undefined &&
        payload.rating !== ''
    ) {
        payload.rating = validateRange(
            payload.rating,
            'Rating',
            0,
            5
        );
    }

    // Reviews
    if (
        payload.reviews !== undefined &&
        payload.reviews !== ''
    ) {
        payload.reviews =
            validateNonNegativeInteger(
                payload.reviews,
                'Reviews'
            );
    }

    return payload;
}


/**
 * Validate product ID parameter
 * @param {string|number} rawId - Raw ID from request params
 * @returns {number|null} Validated ID or null if invalid
 */
export function parseProductIdParam(rawId) {
    if (!/^\d+$/.test(String(rawId)) || Number(rawId) <= 0) return null;
    return Number(rawId);
}

/**
 * Validate a bulk-delete list of product IDs
 * @param {Array} rawIds - Raw ids array from request body
 * @returns {number[]} Unique, validated positive integer ids
 * @throws {ValidationError} If the list is not a valid array of positive integers
 */
export function parseProductIdList(rawIds) {
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
        throw new ValidationError('Product IDs must be a non-empty array');
    }

    if (rawIds.length > 500) {
        throw new ValidationError('Too many product IDs in one request (max 500)');
    }

    const ids = new Set();

    for (const rawId of rawIds) {
        const id = parseProductIdParam(rawId);

        if (!id) {
            throw new ValidationError('Each product ID must be a positive integer');
        }

        ids.add(id);
    }

    return [...ids];
}

/**
 * Parse and validate list query parameters
 * @param {Object} query - Query parameters from request
 * @returns {Object} Normalized query parameters
 */
export function parseListQuery(query) {
    const page = Math.max(
        1,
        Number.parseInt(query.page, 10) || 1
    );

    const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(query.limit, 10) || 50)
    );

    const toArray = (value) => {
        if (value === undefined || value === null || value === '') {
            return [];
        }

        return Array.isArray(value) ? value : [value];
    };

    const parsePrice = (value, fieldName) => {
        if (value === undefined || value === '') {
            return undefined;
        }

        const price = Number(value);

        if (!Number.isFinite(price) || price < 0) {
            throw new Error(`${fieldName} must be a valid non-negative number`);
        }

        return price;
    };

    const filters = {
        page,
        limit,

        search: query.search,
        brands: toArray(query.brand),

        fragranceFamily: toArray(query.fragranceFamily),
        category: toArray(query.category),

        // Support both query.size and query.sizes
        sizes: toArray(query.sizes ?? query.size),

        minPrice: parsePrice(query.minPrice, 'minPrice'),
        maxPrice: parsePrice(query.maxPrice, 'maxPrice'),

        isBestSeller:
            query.isBestSeller === undefined
                ? undefined
                : parseBoolean(query.isBestSeller, 'isBestSeller'),

        isExclusive:
            query.isExclusive === undefined
                ? undefined
                : parseBoolean(query.isExclusive, 'isExclusive'),

        inStockOnly:
            query.inStockOnly === undefined
                ? undefined
                : parseBoolean(query.inStockOnly, 'inStockOnly'),

        featured:
            query.featured === undefined
                ? undefined
                : parseBoolean(query.featured, 'featured')
    };

    if (
        filters.minPrice !== undefined &&
        filters.maxPrice !== undefined &&
        filters.minPrice > filters.maxPrice
    ) {
        throw new Error('minPrice cannot be greater than maxPrice');
    }

    return filters;
}

/**
 * Normalize size pricing and ensure consistency
 * @param {Object} sizePricing - Size pricing object
 * @param {Array} sizes - Available sizes array
 * @returns {Object} Normalized size pricing
 */
export function normalizeSizePricing(sizePricing) {
    if (!sizePricing || typeof sizePricing !== 'object' || Array.isArray(sizePricing)) {
        return {};
    }

    const normalized = {};

    for (const [rawSize, price] of Object.entries(sizePricing)) {
        const sizeNumber = Number(
            String(rawSize)
                .trim()
                .toLowerCase()
                .replace(/\s*ml$/, '')
        );

        const numPrice = Number(price);

        if (
            Number.isFinite(sizeNumber) &&
            sizeNumber > 0 &&
            Number.isFinite(numPrice) &&
            numPrice >= 0
        ) {
            normalized[`${sizeNumber}ml`] = numPrice;
        }
    }

    return normalized;
}

/**
 * Derive sizes from size pricing
 * @param {Object} sizePricing - Size pricing object
 * @returns {Array} Array of size keys
 */
export function deriveSizesFromPricing(sizePricing) {
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
export function ensureSizeConsistency(product) {
    const normalized = { ...product };

    // Normalize size pricing first.
    normalized.sizePricing = normalizeSizePricing(
        product.sizePricing
    );

    // Size pricing is now the source of truth for available sizes.
    if (Object.keys(normalized.sizePricing).length > 0) {
        normalized.sizes = Object.keys(normalized.sizePricing);
    } else if (!Array.isArray(normalized.sizes)) {
        normalized.sizes = [];
    }

    // If sizes exist but there is no pricing, create zero-price entries.
    if (
        Object.keys(normalized.sizePricing).length === 0 &&
        normalized.sizes.length > 0
    ) {
        normalized.sizePricing = {};

        normalized.sizes.forEach((size) => {
            normalized.sizePricing[size] = 0;
        });
    }

    return normalized;
}

