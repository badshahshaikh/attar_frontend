require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const productRoutes = require('./routes/products');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images as static files at /uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve the admin panel HTML UI
app.use(express.static(path.join(__dirname, '../admin')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/products', productRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', db: 'sqlite', time: new Date().toISOString() });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`✅ MS Fragrance Backend (SQLite) running at http://localhost:${PORT}`);
    console.log(`📦 API:   http://localhost:${PORT}/api/products`);
    console.log(`🖼️  Admin: http://localhost:${PORT}`);
});
