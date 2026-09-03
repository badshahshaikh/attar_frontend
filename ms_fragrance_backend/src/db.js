require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
}

function getConnectionString() {
    const connectionUrl = new URL(process.env.DATABASE_URL);
    for (const parameter of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslpassword']) {
        connectionUrl.searchParams.delete(parameter);
    }
    return connectionUrl.toString();
}

const pool = new Pool({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
});

let schemaPromise;

async function initializeDatabase() {
    if (!schemaPromise) {
        const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
        schemaPromise = pool.query(schema);
    }
    await schemaPromise;
    return pool;
}

async function query(text, values) {
    const db = await initializeDatabase();
    return db.query(text, values);
}

async function withTransaction(callback) {
    const db = await initializeDatabase();
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function closeDb() {
    await pool.end();
}

module.exports = { initializeDatabase, query, withTransaction, closeDb };
