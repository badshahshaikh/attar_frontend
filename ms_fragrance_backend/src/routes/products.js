const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// ─── Helper: map SQLite row → camelCase shape (matches mockProducts.js) ───────
function toProduct(row) {
    return {
        id: `p${row.id}`,       // "p1", "p2" — matches mockProducts convention
        dbId: row.id,           // raw integer, used in PUT /api/products/:id
        name: row.name,
        category: row.category,
        fragranceType: row.fragrance_type,
        description: row.description,
        fullDescription: row.full_description,
        rating: row.rating || 0,
        reviews: row.reviews || 0,
        price: row.price,
        ...(row.original_price ? { originalPrice: row.original_price } : {}),
        sizePricing: parseJson(row.size_pricing, {}),
        sizes: parseJson(row.sizes, []),
        topNotes: parseJson(row.top_notes, []),
        heartNotes: parseJson(row.heart_notes, []),
        baseNotes: parseJson(row.base_notes, []),
        longevity: row.longevity,
        inStock: row.in_stock === 1,    // SQLite stores booleans as 0/1
        isNew: row.is_new === 1,
        ...(row.brand ? { brand: row.brand } : {}),
        isBestSeller: row.is_best_seller === 1,
        isExclusive: row.is_exclusive === 1,
        imageUrl: row.image_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// ─── GET /api/products ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const db = await getDb();
        const rows = await db.all('SELECT * FROM products ORDER BY id ASC');
        res.json(rows.map(toProduct));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// ─── GET /api/products/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const db = await getDb();
        const row = await db.get('SELECT * FROM products WHERE id = ?', req.params.id);
        if (!row) return res.status(404).json({ error: 'Product not found' });
        res.json(toProduct(row));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// ─── POST /api/products ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    const {
        name, category, fragranceType, description, fullDescription,
        rating, reviews, price, originalPrice, sizePricing, sizes,
        topNotes, heartNotes, baseNotes, longevity,
        inStock, isNew, brand, isBestSeller, isExclusive, imageUrl,
    } = req.body;

    if (!name || price === undefined) {
        return res.status(400).json({ error: 'name and price are required' });
    }

    try {
        const db = await getDb();
        const result = await db.run(`
            INSERT INTO products
              (name, category, fragrance_type, description, full_description,
               rating, reviews, price, original_price, size_pricing, sizes,
               top_notes, heart_notes, base_notes, longevity,
               in_stock, is_new, brand, is_best_seller, is_exclusive, image_url)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
    const {
        name, category, fragranceType, description, fullDescription,
        rating, reviews, price, originalPrice, sizePricing, sizes,
        topNotes, heartNotes, baseNotes, longevity,
        inStock, isNew, brand, isBestSeller, isExclusive, imageUrl,
    } = req.body;

    try {
        const db = await getDb();

        const existing = await db.get('SELECT id FROM products WHERE id = ?', req.params.id);
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
            imageUrl || null,
            req.params.id,
        ]);

        const updated = await db.get('SELECT * FROM products WHERE id = ?', req.params.id);
        res.json(toProduct(updated));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// ─── DELETE /api/products/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const db = await getDb();

        const existing = await db.get('SELECT id FROM products WHERE id = ?', req.params.id);
        if (!existing) return res.status(404).json({ error: 'Product not found' });

        await db.run('DELETE FROM products WHERE id = ?', req.params.id);
        res.json({ message: 'Product deleted', id: req.params.id });
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
