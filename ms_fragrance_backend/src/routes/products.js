const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const FRAGRANCE_FAMILIES = ['Oud', 'Musk', 'Amber', 'Shamama', 'Floral', 'French', 'Khas', 'Dehn Al Oud'];
const BRANDS = ['MS Fragrance Exclusive', 'Inspire Fragrances', 'Surrati', 'Anfar', 'SMD Ayyub MD Yaqub', 'Al Haramain', 'Swiss Arabian', 'Nemat', 'SH Kelkar'];

// ─── Multer: save uploaded images to /uploads/products ───────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/products');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp|gif/;
        const ok =
            allowed.test(path.extname(file.originalname).toLowerCase()) &&
            allowed.test(file.mimetype);
        ok ? cb(null, true) : cb(new Error('Only image files are allowed'));
    },
});

// ─── Helper: safely parse JSON text fields from SQLite ────────────────────────
function parseJson(val, fallback) {
    if (val === null || val === undefined) return fallback;
    try { return JSON.parse(val); } catch { return fallback; }
}

// ─── Helper: map SQLite row → camelCase shape with a single numeric product ID ─
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
        originalPrice: row.original_price !== null && row.original_price !== undefined ? Number(row.original_price) : null,
        sizePricing: parseJson(row.size_pricing, {}),
        sizes: parseJson(row.sizes, []),
        topNotes: parseJson(row.top_notes, []),
        heartNotes: parseJson(row.heart_notes, []),
        baseNotes: parseJson(row.base_notes, []),
        longevity: row.longevity || '',
        inStock: row.in_stock === 1,
        isNew: row.is_new === 1,
        brand: row.brand || '',
        isBestSeller: row.is_best_seller === 1,
        isExclusive: row.is_exclusive === 1,
        featured: row.featured === 1,
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
    const payload = { ...body };
    payload.fragranceType = payload.fragranceType || payload.fragranceFamily;
    if (!payload.name || !String(payload.name).trim()) throw new Error('Product name is required');
    if (payload.price === undefined || payload.price === '' || !Number.isFinite(Number(payload.price)) || Number(payload.price) < 0) {
        throw new Error('Price must be a non-negative number');
    }
    if (!payload.brand || !String(payload.brand).trim()) throw new Error('Brand is required');
    if (!payload.fragranceType || !String(payload.fragranceType).trim()) throw new Error('Fragrance family is required');
    for (const field of ['sizes', 'topNotes', 'heartNotes', 'baseNotes']) {
        if (payload[field] !== undefined && !Array.isArray(payload[field])) throw new Error(`${field} must be an array`);
    }
    if (payload.sizePricing !== undefined && (typeof payload.sizePricing !== 'object' || Array.isArray(payload.sizePricing) || payload.sizePricing === null)) {
        throw new Error('sizePricing must be an object');
    }
    for (const field of ['inStock', 'isNew', 'isBestSeller', 'isExclusive', 'featured']) {
        payload[field] = parseBoolean(payload[field], field);
    }
    if (payload.stockQuantity !== undefined && (!Number.isInteger(Number(payload.stockQuantity)) || Number(payload.stockQuantity) < 0)) {
        throw new Error('Stock quantity must be a non-negative integer');
    }
    payload.price = Number(payload.price);
    if (payload.originalPrice !== undefined && payload.originalPrice !== null && payload.originalPrice !== '' && (!Number.isFinite(Number(payload.originalPrice)) || Number(payload.originalPrice) < 0)) {
        throw new Error('Original price must be a non-negative number');
    }
    return payload;
}

function parseProductIdParam(rawId) {
    if (rawId === undefined || rawId === null || rawId === '') {
        return { valid: false, error: 'Product ID is required' };
    }

    const trimmed = String(rawId).trim();
    if (!/^\d+$/.test(trimmed) || Number(trimmed) <= 0) {
        return { valid: false, error: 'Product ID must be a positive integer' };
    }

    return { valid: true, value: Number(trimmed) };
}

// ─── GET /api/products ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const db = await getDb();
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
        const conditions = [];
        const values = [];
        if (req.query.search) {
            const search = `%${String(req.query.search).trim()}%`;
            conditions.push('(name LIKE ? OR description LIKE ? OR brand LIKE ? OR fragrance_type LIKE ? OR category LIKE ?)');
            values.push(search, search, search, search, search);
        }
        for (const [queryName, column] of [['brand', 'brand'], ['fragranceFamily', 'fragrance_type']]) {
            if (req.query[queryName]) { conditions.push(`${column} = ?`); values.push(String(req.query[queryName])); }
        }
        for (const [queryName, column] of [['isBestSeller', 'is_best_seller'], ['isExclusive', 'is_exclusive'], ['featured', 'featured']]) {
            if (req.query[queryName] !== undefined) { conditions.push(`${column} = ?`); values.push(parseBoolean(req.query[queryName], queryName) ? 1 : 0); }
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const { total } = await db.get(`SELECT COUNT(*) AS total FROM products ${where}`, values);
        const rows = await db.all(`SELECT * FROM products ${where} ORDER BY id ASC LIMIT ? OFFSET ?`, [...values, limit, (page - 1) * limit]);
        const totalPages = Math.ceil(total / limit);
        res.json({ products: rows.map(toProduct), pagination: { page, limit, totalProducts: total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 } });
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message || 'Failed to fetch products' });
    }
});

router.get('/brands', (req, res) => res.json(BRANDS));
router.get('/fragrance-families', (req, res) => res.json(FRAGRANCE_FAMILIES));

// ─── GET /api/products/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    const parsed = parseProductIdParam(req.params.id);
    if (!parsed.valid) {
        return res.status(400).json({ error: parsed.error });
    }

    try {
        const db = await getDb();
        const row = await db.get('SELECT * FROM products WHERE id = ?', parsed.value);
        if (!row) return res.status(404).json({ error: 'Product not found' });
        res.json(toProduct(row));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// ─── POST /api/products ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    let payload;
    try { payload = parseProductPayload(req.body); } catch (err) { return res.status(400).json({ error: err.message }); }
    const {
        name, category, fragranceType, description, fullDescription,
        rating, reviews, price, originalPrice, sizePricing, sizes,
        topNotes, heartNotes, baseNotes, longevity,
        inStock, isNew, brand, isBestSeller, isExclusive, featured, stockQuantity, imageUrl, slug,
    } = payload;

    try {
        const db = await getDb();
        const result = await db.run(`
            INSERT INTO products
              (name, category, fragrance_type, description, full_description,
               rating, reviews, price, original_price, size_pricing, sizes,
               top_notes, heart_notes, base_notes, longevity,
                    in_stock, is_new, brand, is_best_seller, is_exclusive, featured, stock_quantity, slug, image_url)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [
            name,
            category || 'Attar',
            fragranceType || null,
            description || null,
            fullDescription || null,
            rating || 0,
            reviews || 0,
            price,
            originalPrice || null,
            JSON.stringify(sizePricing || {}),
            JSON.stringify(sizes || []),
            JSON.stringify(topNotes || []),
            JSON.stringify(heartNotes || []),
            JSON.stringify(baseNotes || []),
            longevity || null,
            inStock !== undefined ? (inStock ? 1 : 0) : 1,
            isNew !== undefined ? (isNew ? 1 : 0) : 0,
            brand || null,
            isBestSeller !== undefined ? (isBestSeller ? 1 : 0) : 0,
            isExclusive !== undefined ? (isExclusive ? 1 : 0) : 0,
            featured !== undefined ? (featured ? 1 : 0) : 0,
            stockQuantity !== undefined ? Number(stockQuantity) : (inStock === false ? 0 : 1),
            slug || null,
            imageUrl || null,
        ]);

        const newRow = await db.get('SELECT * FROM products WHERE id = ?', result.lastID);
        res.status(201).json(toProduct(newRow));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// ─── PUT /api/products/:id ────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
    let payload;
    try { payload = parseProductPayload(req.body); } catch (err) { return res.status(400).json({ error: err.message }); }
    const {
        name, category, fragranceType, description, fullDescription,
        rating, reviews, price, originalPrice, sizePricing, sizes,
        topNotes, heartNotes, baseNotes, longevity,
        inStock, isNew, brand, isBestSeller, isExclusive, featured, stockQuantity, imageUrl, slug,
    } = payload;

    const parsed = parseProductIdParam(req.params.id);
    if (!parsed.valid) {
        return res.status(400).json({ error: parsed.error });
    }

    try {
        const db = await getDb();

        const existing = await db.get('SELECT id FROM products WHERE id = ?', parsed.value);
        if (!existing) return res.status(404).json({ error: 'Product not found' });

        await db.run(`
            UPDATE products SET
              name             = ?,
              category         = ?,
              fragrance_type   = ?,
              description      = ?,
              full_description = ?,
              rating           = ?,
              reviews          = ?,
              price            = ?,
              original_price   = ?,
              size_pricing     = ?,
              sizes            = ?,
              top_notes        = ?,
              heart_notes      = ?,
              base_notes       = ?,
              longevity        = ?,
              in_stock         = ?,
              is_new           = ?,
              brand            = ?,
              is_best_seller   = ?,
              is_exclusive     = ?,
              featured         = ?,
              stock_quantity   = ?,
              slug             = ?,
              image_url        = ?,
              updated_at       = datetime('now')
            WHERE id = ?
        `, [
            name,
            category || 'Attar',
            fragranceType || null,
            description || null,
            fullDescription || null,
            rating || 0,
            reviews || 0,
            price,
            originalPrice || null,
            JSON.stringify(sizePricing || {}),
            JSON.stringify(sizes || []),
            JSON.stringify(topNotes || []),
            JSON.stringify(heartNotes || []),
            JSON.stringify(baseNotes || []),
            longevity || null,
            inStock !== undefined ? (inStock ? 1 : 0) : 1,
            isNew !== undefined ? (isNew ? 1 : 0) : 0,
            brand || null,
            isBestSeller !== undefined ? (isBestSeller ? 1 : 0) : 0,
            isExclusive !== undefined ? (isExclusive ? 1 : 0) : 0,
            featured !== undefined ? (featured ? 1 : 0) : 0,
            stockQuantity !== undefined ? Number(stockQuantity) : 0,
            slug || null,
            imageUrl || null,
            parsed.value,
        ]);

        const updated = await db.get('SELECT * FROM products WHERE id = ?', parsed.value);
        res.json(toProduct(updated));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// ─── DELETE /api/products/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    const parsed = parseProductIdParam(req.params.id);
    if (!parsed.valid) {
        return res.status(400).json({ error: parsed.error });
    }

    try {
        const db = await getDb();

        const existing = await db.get('SELECT id FROM products WHERE id = ?', parsed.value);
        if (!existing) return res.status(404).json({ error: 'Product not found' });

        await db.run('DELETE FROM products WHERE id = ?', parsed.value);
        res.json({ message: 'Product deleted', id: parsed.value });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// ─── POST /api/products/upload-image ─────────────────────────────────────────
router.post('/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const imageUrl = `/uploads/products/${req.file.filename}`;
    res.json({ imageUrl, filename: req.file.filename });
});

module.exports = router;
