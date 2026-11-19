import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';

function normalizeOrigin(origin) {
    return String(origin || '').trim().replace(/\/+$/, '');
}

const developmentOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5000',
    'http://localhost:4173',
];

const configuredOrigins = [
    ...(isProduction ? ['https://attar-frontend-tau.vercel.app'] : developmentOrigins),
    ...(process.env.CORS_ORIGINS || '').split(','),
    process.env.FRONTEND_URL,
];

const allowedOrigins = [...new Set(configuredOrigins.map(normalizeOrigin).filter(Boolean))];

const config = Object.freeze({
    environment,
    isProduction,
    port: process.env.PORT || 5000,
    database: Object.freeze({
        url: process.env.DATABASE_URL,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    }),
    cors: Object.freeze({ allowedOrigins }),
    auth: Object.freeze({
        jwtSecret: process.env.JWT_SECRET,
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
        customerJwtExpiresIn: process.env.CUSTOMER_JWT_EXPIRES_IN || '30d',
        backendServiceKey: process.env.BACKEND_SERVICE_KEY,
        cookie: Object.freeze({
            name: 'jwt',
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'None' : 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
        // Customer sessions live in a separate cookie so signing into the
        // storefront never overwrites an admin session, and vice versa.
        customerCookie: Object.freeze({
            name: 'customer_jwt',
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'None' : 'Lax',
            maxAge: 30 * 24 * 60 * 60 * 1000,
        }),
    }),
    storage: Object.freeze({
        url: process.env.SUPABASE_URL,
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        bucket: process.env.SUPABASE_STORAGE_BUCKET || 'product-images',
    }),
    razorpay: Object.freeze({
        keyId: process.env.RAZORPAY_KEY_ID || '',
        keySecret: process.env.RAZORPAY_KEY_SECRET || '',
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    }),
    uploads: Object.freeze({
        directory: path.resolve(
            process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads')
        ),
    }),
});

export { config, normalizeOrigin };