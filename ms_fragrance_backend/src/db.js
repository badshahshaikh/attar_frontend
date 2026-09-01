/**
 * db.js — SQLite connection + auto-initialization
 *
 * Uses:
 *   sqlite3  – prebuilt native bindings (no compiler/build tools needed)
 *   sqlite   – thin Promise wrapper around sqlite3
 *
 * Database file: ms_fragrance_backend/data/ms_fragrance.db
 * Created automatically on first run. No setup script, no server, no password.
 */

const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data/ directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'ms_fragrance.db');

// Module-level singleton — resolved once on first require()
let _db = null;

async function getDb() {
    if (_db) return _db;

    _db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database,
    });

    // Enable WAL for better performance
    await _db.run('PRAGMA journal_mode = WAL');

    // Auto-create table on first run
    await _db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            name             TEXT    NOT NULL,
            category         TEXT    DEFAULT 'Attar',
            fragrance_type   TEXT,
            description      TEXT,
            full_description TEXT,
            rating           REAL    DEFAULT 0,
            reviews          INTEGER DEFAULT 0,
            price            REAL    NOT NULL,
            original_price   REAL,
            size_pricing     TEXT    DEFAULT '{}',
            sizes            TEXT    DEFAULT '[]',
            top_notes        TEXT    DEFAULT '[]',
            heart_notes      TEXT    DEFAULT '[]',
            base_notes       TEXT    DEFAULT '[]',
            longevity        TEXT,
            in_stock         INTEGER DEFAULT 1,
            is_new           INTEGER DEFAULT 0,
            brand            TEXT,
            is_best_seller   INTEGER DEFAULT 0,
            is_exclusive     INTEGER DEFAULT 0,
            image_url        TEXT,
            created_at       TEXT    DEFAULT (datetime('now')),
            updated_at       TEXT    DEFAULT (datetime('now'))
        );
    `);

    // Add new columns if they don't exist (for existing databases)
    try {
        await _db.exec('ALTER TABLE products ADD COLUMN brand TEXT');
    } catch (err) {
        // Column already exists, ignore
    }
    try {
        await _db.exec('ALTER TABLE products ADD COLUMN is_best_seller INTEGER DEFAULT 0');
    } catch (err) {
        // Column already exists, ignore
    }
    try {
        await _db.exec('ALTER TABLE products ADD COLUMN is_exclusive INTEGER DEFAULT 0');
    } catch (err) {
        // Column already exists, ignore
    }

    console.log(`🗄️  SQLite database ready → ${DB_PATH}`);
    return _db;
}

module.exports = { getDb };
