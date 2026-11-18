const JSON_FIELDS = new Set(['size_pricing', 'sizes', 'top_notes', 'heart_notes', 'base_notes', 'image_urls']);

const FIELD_TO_COLUMN = {
    name: 'name',
    category: 'category',
    fragranceType: 'fragrance_type',
    description: 'description',
    fullDescription: 'full_description',
    rating: 'rating',
    reviews: 'reviews',
    price: 'price',
    originalPrice: 'original_price',
    sizePricing: 'size_pricing',
    sizes: 'sizes',
    topNotes: 'top_notes',
    heartNotes: 'heart_notes',
    baseNotes: 'base_notes',
    longevity: 'longevity',
    inStock: 'in_stock',
    isNew: 'is_new',
    brand: 'brand',
    isBestSeller: 'is_best_seller',
    isExclusive: 'is_exclusive',
    featured: 'featured',
    stockQuantity: 'stock_quantity',
    slug: 'slug',
    imageUrl: 'image_url',
    imageUrls: 'image_urls',
};

function toProduct(row) {
    return {
        id: Number(row.id), name: row.name, category: row.category || 'Attar',
        fragranceType: row.fragrance_type || '', description: row.description || '',
        fullDescription: row.full_description || '', rating: Number(row.rating || 0),
        reviews: Number(row.reviews || 0), price: Number(row.price),
        originalPrice: row.original_price === null ? null : Number(row.original_price),
        sizePricing: row.size_pricing || {}, sizes: row.sizes || [],
        topNotes: row.top_notes || [], heartNotes: row.heart_notes || [],
        baseNotes: row.base_notes || [], longevity: row.longevity || '',
        inStock: Boolean(row.in_stock), isNew: Boolean(row.is_new), brand: row.brand || '',
        isBestSeller: Boolean(row.is_best_seller), isExclusive: Boolean(row.is_exclusive),
        featured: Boolean(row.featured), stockQuantity: Number(row.stock_quantity || 0),
        slug: row.slug || '', imageUrl: row.image_url || '',
        imageUrls: Array.isArray(row.image_urls) ? row.image_urls : [],
        createdAt: row.created_at, updatedAt: row.updated_at,
    };
}

function toPersistenceValues(payload) {
    const values = [
        payload.name,
        payload.category || 'Attar',
        payload.fragranceType || null,
        payload.description || null,
        payload.fullDescription || null,
        payload.rating || 0,
        payload.reviews || 0,
        payload.price,
        payload.originalPrice || null,
        payload.sizePricing || {},
        payload.sizes || [],
        payload.topNotes || [],
        payload.heartNotes || [],
        payload.baseNotes || [],
        payload.longevity || null,
        payload.inStock !== undefined ? payload.inStock : true,
        payload.isNew !== undefined ? payload.isNew : false,
        payload.brand || null,
        payload.isBestSeller !== undefined ? payload.isBestSeller : false,
        payload.isExclusive !== undefined ? payload.isExclusive : false,
        payload.featured !== undefined ? payload.featured : false,
        payload.stockQuantity !== undefined
            ? Number(payload.stockQuantity)
            : (payload.inStock === false ? 0 : 1),
        payload.slug || null,
        payload.imageUrl || null,
        Array.isArray(payload.imageUrls) ? payload.imageUrls : [],
    ];

    const columns = [
        'name',
        'category',
        'fragrance_type',
        'description',
        'full_description',
        'rating',
        'reviews',
        'price',
        'original_price',
        'size_pricing',
        'sizes',
        'top_notes',
        'heart_notes',
        'base_notes',
        'longevity',
        'in_stock',
        'is_new',
        'brand',
        'is_best_seller',
        'is_exclusive',
        'featured',
        'stock_quantity',
        'slug',
        'image_url',
        'image_urls'
    ];

    const persistenceValues = values.map((value, index) =>
        JSON_FIELDS.has(columns[index])
            ? JSON.stringify(value)
            : value
    );

    console.log(
        'SIZE PRICING BEFORE DB:',
        payload.sizePricing
    );

    console.log(
        'SIZE PRICING AFTER DB CONVERSION:',
        persistenceValues[9]
    );

    return persistenceValues;
}

/**
 * Convert a partial product payload (camelCase field names) to a
 * column->value object suitable for a partial SQL UPDATE. Only provided
 * fields are included. JSON fields are serialized; null values are
 * preserved as null (not treated as omitted).
 *
 * @param {Object} partialPayload - Normalized partial payload from parsePartialProductPayload
 * @returns {Object} Column->value map for only the provided fields
 */
function toPartialPersistenceValues(partialPayload) {
    const updates = {};

    for (const [field, value] of Object.entries(partialPayload)) {
        const column = FIELD_TO_COLUMN[field];
        if (!column) continue;

        if (JSON_FIELDS.has(column) && value !== undefined && value !== null) {
            updates[column] = JSON.stringify(value);
        } else {
            updates[column] = value;
        }
    }

    return updates;
}

export {
  toProduct, toPersistenceValues, toPartialPersistenceValues
};
