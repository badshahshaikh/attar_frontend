require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { query } = require('../db');
const { uploadProductImage, removeProductImage, getStoragePath } = require('../config/supabase');

const router = express.Router();
const FRAGRANCE_FAMILIES = ['Oud', 'Musk', 'Amber', 'Shamama', 'Floral', 'French', 'Khas', 'Dehn Al Oud'];
const BRANDS = ['MS Fragrance Exclusive', 'Inspire Fragrances', 'Surrati', 'Anfar', 'SMD Ayyub MD Yaqub', 'Al Haramain', 'Swiss Arabian', 'Nemat', 'SH Kelkar'];
const PRODUCT_COLUMNS = `
    id, name, category, fragrance_type, description, full_description,
    rating, reviews, price, original_price, size_pricing, sizes,
    top_notes, heart_notes, base_notes, longevity, in_stock, is_new,
    brand, is_best_seller, is_exclusive, featured, stock_quantity, slug,
    image_url, created_at, updated_at
`;
const JSON_FIELDS = new Set(['size_pricing', 'sizes', 'top_notes', 'heart_notes', 'base_notes']);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
        const valid = allowed.has(file.mimetype);
        valid ? cb(null, true) : cb(new Error('Only image files are allowed'));
    },
});

function toProduct(row) {
    return {
        id: Number(row.id),
        name: row.name,
        category: row.category || 'Attar',
        fragranceType: row.fragrance_type || '',
        description: row.description || '',
        fullDescription: row.full_description || '',
        rating: Number(row.rating || 0),
        reviews: Number(row.reviews || 0),
        price: Number(row.price),
        originalPrice: row.original_price === null ? null : Number(row.original_price),
        sizePricing: row.size_pricing || {},
        sizes: row.sizes || [],
        topNotes: row.top_notes || [],
        heartNotes: row.heart_notes || [],
        baseNotes: row.base_notes || [],
        longevity: row.longevity || '',
        inStock: Boolean(row.in_stock),
        isNew: Boolean(row.is_new),
        brand: row.brand || '',
        isBestSeller: Boolean(row.is_best_seller),
        isExclusive: Boolean(row.is_exclusive),
        featured: Boolean(row.featured),
        stockQuantity: Number(row.stock_quantity || 0),
        slug: row.slug || '',
        imageUrl: row.image_url || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

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

function productValues(payload, includeId) {
    const values = [
        payload.name, payload.category || 'Attar', payload.fragranceType || null,
        payload.description || null, payload.fullDescription || null,
        payload.rating || 0, payload.reviews || 0, payload.price,
        payload.originalPrice || null, payload.sizePricing || {}, payload.sizes || [],
        payload.topNotes || [], payload.heartNotes || [], payload.baseNotes || [],
        payload.longevity || null, payload.inStock !== undefined ? payload.inStock : true,
        payload.isNew !== undefined ? payload.isNew : false, payload.brand || null,
        payload.isBestSeller !== undefined ? payload.isBestSeller : false,
        payload.isExclusive !== undefined ? payload.isExclusive : false,
        payload.featured !== undefined ? payload.featured : false,
        payload.stockQuantity !== undefined ? Number(payload.stockQuantity) : (payload.inStock === false ? 0 : 1),
        payload.slug || null, payload.imageUrl || null,
    ];
    const serializedValues = values.map((value, index) => {
        const column = ['name', 'category', 'fragrance_type', 'description', 'full_description', 'rating', 'reviews', 'price', 'original_price', 'size_pricing', 'sizes', 'top_notes', 'heart_notes', 'base_notes', 'longevity', 'in_stock', 'is_new', 'brand', 'is_best_seller', 'is_exclusive', 'featured', 'stock_quantity', 'slug', 'image_url'][index];
        return JSON_FIELDS.has(column) ? JSON.stringify(value) : value;
    });
    return includeId ? [payload.id, ...serializedValues] : serializedValues;
}

function extensionForMimeType(mimeType) {
    return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mimeType];
}

async function cleanupImage(imageUrl) {
    if (!getStoragePath(imageUrl)) return;
    try {
        await removeProductImage(imageUrl);
    } catch (error) {
        console.error('Supabase image cleanup failed');
    }
}

router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
        const conditions = [];
        const values = [];
        if (req.query.search) {
            const search = `%${String(req.query.search).trim()}%`;
            conditions.push('(name ILIKE $1 OR description ILIKE $1 OR brand ILIKE $1 OR fragrance_type ILIKE $1 OR category ILIKE $1)');
            values.push(search);
        }
        for (const [queryName, column] of [['brand', 'brand'], ['fragranceFamily', 'fragrance_type'], ['category', 'category']]) {
            if (req.query[queryName]) { conditions.push(`${column} = $${values.length + 1}`); values.push(String(req.query[queryName])); }
        }
        for (const [queryName, column] of [['isBestSeller', 'is_best_seller'], ['isExclusive', 'is_exclusive'], ['featured', 'featured']]) {
            if (req.query[queryName] !== undefined) { conditions.push(`${column} = $${values.length + 1}`); values.push(parseBoolean(req.query[queryName], queryName)); }
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const countResult = await query(`SELECT COUNT(*)::int AS total FROM products ${where}`, values);
        const total = countResult.rows[0].total;
        const limitIndex = values.length + 1;
        const offsetIndex = values.length + 2;
        const result = await query(`SELECT ${PRODUCT_COLUMNS} FROM products ${where} ORDER BY id ASC LIMIT $${limitIndex} OFFSET $${offsetIndex}`, [...values, limit, (page - 1) * limit]);
        const totalPages = Math.ceil(total / limit);
        res.json({ products: result.rows.map(toProduct), pagination: { page, limit, totalProducts: total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 } });
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message || 'Failed to fetch products' });
    }
});

router.get('/brands', (req, res) => res.json(BRANDS));
router.get('/fragrance-families', (req, res) => res.json(FRAGRANCE_FAMILIES));

router.post('/upload-image', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
        const productId = String(req.body.productId || 'new').replace(/[^a-zA-Z0-9_-]/g, '-');
        const extension = extensionForMimeType(req.file.mimetype);
        const objectPath = `products/product-${productId}/image-${Date.now()}.${extension}`;
        const uploaded = await uploadProductImage(req.file, objectPath);
        res.json({ imageUrl: uploaded.url, filename: uploaded.path });
    } catch (error) {
        console.error('Supabase image upload failed');
        res.status(502).json({ error: 'Image upload failed' });
    }
});

router.get('/:id', async (req, res) => {
    const id = parseProductIdParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Product ID must be a positive integer' });
    try {
        const result = await query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = $1`, [id]);
        if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
        res.json(toProduct(result.rows[0]));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch product' }); }
});

router.post('/', async (req, res) => {
    let payload;
    try { payload = parseProductPayload(req.body); } catch (err) { return res.status(400).json({ error: err.message }); }
    try {
        const values = productValues(payload, false);
        const result = await query(`INSERT INTO products (name, category, fragrance_type, description, full_description, rating, reviews, price, original_price, size_pricing, sizes, top_notes, heart_notes, base_notes, longevity, in_stock, is_new, brand, is_best_seller, is_exclusive, featured, stock_quantity, slug, image_url) VALUES (${values.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING ${PRODUCT_COLUMNS}`, values);
        res.status(201).json(toProduct(result.rows[0]));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create product' }); }
});

router.put('/:id', async (req, res) => {
    const id = parseProductIdParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Product ID must be a positive integer' });
    let payload;
    try { payload = parseProductPayload(req.body); } catch (err) { return res.status(400).json({ error: err.message }); }
    try {
        const values = productValues(payload, false);
        const columns = ['name', 'category', 'fragrance_type', 'description', 'full_description', 'rating', 'reviews', 'price', 'original_price', 'size_pricing', 'sizes', 'top_notes', 'heart_notes', 'base_notes', 'longevity', 'in_stock', 'is_new', 'brand', 'is_best_seller', 'is_exclusive', 'featured', 'stock_quantity', 'slug', 'image_url'];
        const assignments = columns.map((column, index) => `${column} = $${index + 1}`).join(', ');
        const previous = await query(`SELECT image_url FROM products WHERE id = $1`, [id]);
        const result = await query(`UPDATE products SET ${assignments}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING ${PRODUCT_COLUMNS}`, [...values, id]);
        if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
        if (previous.rows[0] && previous.rows[0].image_url !== result.rows[0].image_url) await cleanupImage(previous.rows[0].image_url);
        res.json(toProduct(result.rows[0]));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update product' }); }
});

router.delete('/:id', async (req, res) => {
    const id = parseProductIdParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Product ID must be a positive integer' });
    try {
        const existing = await query('SELECT image_url FROM products WHERE id = $1', [id]);
        const result = await query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
        if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
        if (existing.rows[0]) await cleanupImage(existing.rows[0].image_url);
        res.json({ message: 'Product deleted', id });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to delete product' }); }
});

module.exports = router;
