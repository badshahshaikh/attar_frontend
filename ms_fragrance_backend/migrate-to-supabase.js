require('dotenv').config();
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { query, withTransaction, closeDb } from './src/db.js';

const sqlitePath = process.env.SQLITE_PATH || path.join(__dirname, 'data', 'ms_fragrance.db');
const jsonFields = ['size_pricing', 'sizes', 'top_notes', 'heart_notes', 'base_notes'];

function parseJson(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    try { return JSON.parse(value); } catch { throw new Error(`Invalid JSON in SQLite field: ${value}`); }
}

function toBoolean(value) {
    return value === true || value === 1 || value === '1';
}

function mapProduct(row) {
    const product = { ...row };
    for (const field of jsonFields) product[field] = parseJson(row[field], field === 'size_pricing' ? {} : []);
    for (const field of ['in_stock', 'is_new', 'is_best_seller', 'is_exclusive', 'featured']) product[field] = toBoolean(row[field]);
    product.stock_quantity = Number(row.stock_quantity || 0);
    return product;
}

async function migrate() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to migrate');
    const sqlite = await open({ filename: sqlitePath, driver: sqlite3.Database });
    const rows = await sqlite.all('SELECT * FROM products ORDER BY id ASC');
    const columns = ['id', 'name', 'category', 'fragrance_type', 'description', 'full_description', 'rating', 'reviews', 'price', 'original_price', 'size_pricing', 'sizes', 'top_notes', 'heart_notes', 'base_notes', 'longevity', 'in_stock', 'is_new', 'brand', 'is_best_seller', 'is_exclusive', 'featured', 'stock_quantity', 'slug', 'image_url', 'created_at', 'updated_at'];
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const updates = columns.filter(column => column !== 'id').map(column => `${column} = EXCLUDED.${column}`).join(', ');
    await withTransaction(async client => {
        for (const row of rows) {
            const product = mapProduct(row);
            const values = columns.map(column => {
                if (product[column] === undefined) return null;
                return jsonFields.includes(column) ? JSON.stringify(product[column]) : product[column];
            });
            await client.query(`INSERT INTO products (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updates}`, values);
        }
    });

    const migrated = await query('SELECT COUNT(*)::int AS count FROM products');
    console.log(`Migrated ${rows.length} SQLite products. Supabase now contains ${migrated.rows[0].count} products.`);
    console.log(`SQLite backup retained at ${sqlitePath}`);
    await sqlite.close();
    await closeDb();
}

migrate().catch(async error => {
    console.error('Supabase migration failed:', error.message);
    try { await closeDb(); } catch {}
    process.exitCode = 1;
});