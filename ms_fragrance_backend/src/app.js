require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const productRoutes = require('./routes/products');
const authRoutes = require('./routes/auth');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const developmentOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://localhost:4173',
];
const configuredOrigins = isProduction
    ? [process.env.FRONTEND_URL]
    : [...developmentOrigins, ...(process.env.CORS_ORIGINS || '').split(',')];
const allowedOrigins = configuredOrigins.map(origin => origin && origin.trim()).filter(Boolean);
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'));

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Origin is not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, '../admin')));

app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);

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

module.exports = app;