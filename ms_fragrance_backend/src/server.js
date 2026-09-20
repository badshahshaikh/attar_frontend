import app from './app.js';
const { closeDb } = require('./db');
const { config } = require('./config/env');
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`✅ MS Fragrance Backend (PostgreSQL) running on port ${PORT}`);
    console.log(`📦 API:   /api/products`);
});

async function shutdown(signal) {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
        await closeDb();
        process.exit(0);
    });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
