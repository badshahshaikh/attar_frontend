/**
 * productHelpers.js - Product utility functions
 * 
 * Pure functions for product data transformation and normalization.
 */

/**
 * Convert array to comma-separated string
 */
export function arrayToCsv(value) {
    return Array.isArray(value) ? value.join(', ') : '';
}

/**
 * Convert comma-separated string to array
 */
export function csvToArray(value) {
    return value ? value.split(',').map(item => item.trim()).filter(Boolean) : [];
}

/**
 * Convert product data to form format
 */
export function productToForm(product, emptyProduct) {
    const sizePricing = product.sizePricing || {};

    const sizePricingRows = Object.entries(sizePricing).map(
        ([size, price]) => ({
            size: String(size).replace(/ml$/i, ''),
            price: price ?? '',
        })
    );

    return {
        ...emptyProduct,
        ...product,

        sizes: arrayToCsv(product.sizes),
        topNotes: arrayToCsv(product.topNotes),
        heartNotes: arrayToCsv(product.heartNotes),
        baseNotes: arrayToCsv(product.baseNotes),

        sizePricing: sizePricingRows,

        originalPrice: product.originalPrice ?? '',
        imageUrl: product.imageUrl || '',
    };
}

/**
 * Convert form data to product payload
 */
export function formToProductPayload(values) {
    const sizePricingRows = Array.isArray(values.sizePricing)
        ? values.sizePricing
        : [];

    const sizePricing = sizePricingRows.reduce((result, item) => {
        const size = Number(item?.size);
        const price = Number(item?.price);

        if (
            Number.isFinite(size) &&
            size > 0 &&
            Number.isFinite(price) &&
            price >= 0
        ) {
            result[`${size}ml`] = price;
        }

        return result;
    }, {});

    const sizes = Object.keys(sizePricing);

    return {
        ...values,

        price: Number(values.price),

        originalPrice:
            values.originalPrice === ''
                ? null
                : Number(values.originalPrice),

        stockQuantity: Number(values.stockQuantity),
        rating: Number(values.rating),
        reviews: Number(values.reviews),

        // Derived from sizePricing — no second source of truth
        sizes,

        sizePricing,

        topNotes: csvToArray(values.topNotes),
        heartNotes: csvToArray(values.heartNotes),
        baseNotes: csvToArray(values.baseNotes)
    };
}

/**
 * Build size pricing object from row data
 */
export function buildSizePricing(row, sizeKeys) {
    const sp = {};
    for (const size of sizeKeys) {
        const v = parseFloat(row[`price_${size}`]);
        if (!isNaN(v) && v >= 0) {
            sp[size] = v;
        }
    }
    return sp;
}

/**
 * Build product payload from bulk row data
 */
export function buildBulkPayload(row, sizeKeys) {
    const sp = buildSizePricing(row, sizeKeys);
    const sizes = Object.keys(sp);
    const autoPrice = sizes.length > 0 ? Math.min(...Object.values(sp)) : undefined;
    const price = row.price !== '' && row.price !== undefined ? parseFloat(row.price) : autoPrice ?? '';
    const toArr = v => v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : [];

    return {
        name: row.name,
        brand: row.brand,
        fragranceType: row.fragranceType,
        category: row.category || 'Attar',
        price,
        originalPrice: row.originalPrice ? parseFloat(row.originalPrice) : null,
        sizePricing: sp,
        sizes,
        rating: row.rating !== '' ? parseFloat(row.rating) : 0,
        reviews: row.reviews !== '' ? parseInt(row.reviews, 10) : 0,
        stockQuantity: row.stockQuantity !== '' ? parseInt(row.stockQuantity, 10) : 0,
        inStock: row.inStock !== false,
        isNew: Boolean(row.isNew),
        isBestSeller: Boolean(row.isBestSeller),
        isExclusive: Boolean(row.isExclusive),
        featured: Boolean(row.featured),
        description: row.description || '',
        fullDescription: row.fullDescription || '',
        topNotes: toArr(row.topNotes),
        heartNotes: toArr(row.heartNotes),
        baseNotes: toArr(row.baseNotes),
        longevity: row.longevity || '',
        imageUrl: row.imageUrl || '',
        slug: row.slug || '',
    };
}
