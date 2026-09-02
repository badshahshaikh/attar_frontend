require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const productRoutes = require('./routes/products');
const authRoutes = require('./routes/auth');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://localhost:4173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'));

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Origin is not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images as static files at /uploads
app.use('/uploads', express.static(uploadDir));

// Serve the admin panel HTML UI
app.use(express.static(path.join(__dirname, '../admin')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        environment: process.env.NODE_ENV || 'development',
        database: 'postgresql',
        timestamp: new Date().toISOString(),
    });
});

app.use((error, req, res, next) => {
    if (error instanceof Error && (error.code === 'LIMIT_FILE_SIZE' || error.message === 'Only image files are allowed')) {
        return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : error.message });
    }
    return next(error);
});

// ─── Start ────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
    console.log(`✅ MS Fragrance Backend (PostgreSQL) running on port ${PORT}`);
    console.log(`📦 API:   /api/products`);
    console.log(`🖼️  Admin: /`);
});

async function shutdown(signal) {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
        const { closeDb } = require('./db');
        await closeDb();
        process.exit(0);
    });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
