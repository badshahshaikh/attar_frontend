function parseBoolean(value, fieldName) {
    if (value === undefined) return undefined;
    if (value === true || value === false) return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    throw new Error(`${fieldName} must be a boolean`);
}

function parseProductPayload(body) {
    const payload = { ...body, fragranceType: body.fragranceType || body.fragranceFamily };
    if (!payload.name || !String(payload.name).trim()) throw new Error('Product name is required');
    if (payload.price === undefined || payload.price === '' || !Number.isFinite(Number(payload.price)) || Number(payload.price) < 0) throw new Error('Price must be a non-negative number');
    if (!payload.brand || !String(payload.brand).trim()) throw new Error('Brand is required');
    if (!payload.fragranceType || !String(payload.fragranceType).trim()) throw new Error('Fragrance family is required');
    for (const field of ['sizes', 'topNotes', 'heartNotes', 'baseNotes']) {
        if (payload[field] !== undefined && !Array.isArray(payload[field])) throw new Error(`${field} must be an array`);
    }
    if (payload.sizePricing !== undefined && (typeof payload.sizePricing !== 'object' || Array.isArray(payload.sizePricing) || payload.sizePricing === null)) throw new Error('sizePricing must be an object');
    for (const field of ['inStock', 'isNew', 'isBestSeller', 'isExclusive', 'featured']) payload[field] = parseBoolean(payload[field], field);
    if (payload.stockQuantity !== undefined && (!Number.isInteger(Number(payload.stockQuantity)) || Number(payload.stockQuantity) < 0)) throw new Error('Stock quantity must be a non-negative integer');
    payload.price = Number(payload.price);
    if (payload.originalPrice !== undefined && payload.originalPrice !== null && payload.originalPrice !== '' && (!Number.isFinite(Number(payload.originalPrice)) || Number(payload.originalPrice) < 0)) throw new Error('Original price must be a non-negative number');
    return payload;
}

function parseProductIdParam(rawId) {
    if (!/^\d+$/.test(String(rawId)) || Number(rawId) <= 0) return null;
    return Number(rawId);
}

function parseListQuery(query) {
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 50));
    return { page, limit, search: query.search, brand: query.brand, fragranceFamily: query.fragranceFamily, category: query.category,
        isBestSeller: query.isBestSeller === undefined ? undefined : parseBoolean(query.isBestSeller, 'isBestSeller'),
        isExclusive: query.isExclusive === undefined ? undefined : parseBoolean(query.isExclusive, 'isExclusive'),
        featured: query.featured === undefined ? undefined : parseBoolean(query.featured, 'featured') };
}

module.exports = { parseBoolean, parseProductPayload, parseProductIdParam, parseListQuery };
