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

    // Slug: preserve an explicitly supplied valid slug; otherwise mark as
    // not-provided so the create use case can generate one from the name.
    // On update, an absent slug means "leave the existing value unchanged."
    if (
        payload.slug !== undefined &&
        payload.slug !== null &&
        String(payload.slug).trim() !== ''
    ) {
        payload.slug = String(payload.slug).trim();
    } else {
        payload.slug = undefined;
    }

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
export function slugify(name) {
    return String(name ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/, '')
        || null;
}

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

/**
 * Validate and normalize a partial product payload for updates.
 * Only fields explicitly present in `body` (not undefined) are validated
 * and returned. Omitted fields are absent from the result so the caller
 * can preserve existing values. Explicitly supplied null values are
 * preserved as null (not treated as omitted).
 *
 * @param {Object} body - Raw partial product data from request
 * @returns {Object} Normalized partial payload with only provided fields
 * @throws {ValidationError} If no updatable field is provided
 */
export function parsePartialProductPayload(body) {
    const payload = {};
    let hasAnyField = false;

    const setField = (key, value) => {
        payload[key] = value;
        hasAnyField = true;
    };

    // ── Required-on-create fields are optional here ──────────────────
    if (body.name !== undefined) {
        setField('name', requireText(body.name, 'Product name'));
    }
    if (body.brand !== undefined) {
        setField('brand', requireText(body.brand, 'Brand'));
    }
    if (body.fragranceFamily !== undefined) {
        setField('fragranceType', requireText(body.fragranceFamily, 'Fragrance family'));
    } else if (body.fragranceType !== undefined) {
        setField('fragranceType', requireText(body.fragranceType, 'Fragrance family'));
    }
    if (body.price !== undefined) {
        setField('price', validateNonNegativeNumber(body.price, 'Price', { required: true }));
    }

    // ── Optional scalar fields ───────────────────────────────────────
    const optionalTextToNull = (value) => (value === '' ? null : value);

    if (body.category !== undefined) {
        setField('category', optionalTextToNull(body.category));
    }
    if (body.description !== undefined) {
        setField('description', optionalTextToNull(body.description));
    }
    if (body.fullDescription !== undefined) {
        setField('fullDescription', optionalTextToNull(body.fullDescription));
    }
    if (body.longevity !== undefined) {
        setField('longevity', optionalTextToNull(body.longevity));
    }
    if (body.originalPrice !== undefined) {
        if (body.originalPrice === null || body.originalPrice === '') {
            setField('originalPrice', null);
        } else {
            setField('originalPrice', validateNonNegativeNumber(body.originalPrice, 'Original price'));
        }
    }
    if (body.rating !== undefined) {
        if (body.rating === null || body.rating === '') {
            setField('rating', null);
        } else {
            setField('rating', validateRange(body.rating, 'Rating', 0, 5));
        }
    }
    if (body.reviews !== undefined) {
        if (body.reviews === null || body.reviews === '') {
            setField('reviews', null);
        } else {
            setField('reviews', validateNonNegativeInteger(body.reviews, 'Reviews'));
        }
    }
    if (body.slug !== undefined) {
        if (body.slug === null || body.slug === '') {
            setField('slug', null);
        } else {
            setField('slug', String(body.slug).trim());
        }
    }
    if (body.imageUrl !== undefined) {
        setField('imageUrl', optionalTextToNull(body.imageUrl));
    }

    // ── Array fields ─────────────────────────────────────────────────
    validateArrayFields(body, ['sizes', 'topNotes', 'heartNotes', 'baseNotes', 'imageUrls']);

    if (body.sizes !== undefined) {
        setField('sizes', body.sizes);
    }
    if (body.topNotes !== undefined) {
        setField('topNotes', body.topNotes);
    }
    if (body.heartNotes !== undefined) {
        setField('heartNotes', body.heartNotes);
    }
    if (body.baseNotes !== undefined) {
        setField('baseNotes', body.baseNotes);
    }
    if (body.imageUrls !== undefined) {
        setField('imageUrls', body.imageUrls);
    }

    // ── Size pricing (normalize; derive sizes from it if provided) ────
    validateObjectField(body, 'sizePricing', 'sizePricing must be an object');
    if (body.sizePricing !== undefined) {
        setField('sizePricing', normalizeSizePricing(body.sizePricing));
        if (Object.keys(payload.sizePricing || {}).length > 0) {
            // Derive sizes from sizePricing only when sizePricing is explicitly provided
            setField('sizes', Object.keys(payload.sizePricing));
        }
    } else if (body.sizes !== undefined && body.sizePricing === undefined) {
        // sizes provided without sizePricing: keep sizes as-is, do not
        // auto-generate sizePricing (that would touch an unprovided field)
    }

    // ── Boolean fields ───────────────────────────────────────────────
    for (const field of [
        'inStock',
        'isNew',
        'isBestSeller',
        'isExclusive',
        'featured'
    ]) {
        if (body[field] !== undefined) {
            setField(field, parseBoolean(body[field], field));
        }
    }

    // ── Stock quantity ───────────────────────────────────────────────
    if (body.stockQuantity !== undefined) {
        setField('stockQuantity', validateNonNegativeInteger(body.stockQuantity, 'Stock quantity'));
    }

    if (!hasAnyField) {
        throw new ValidationError('At least one field must be provided to update a product');
    }

    return payload;
}

