const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { config } = require('../../config/env');

if (!config.database.url) {
    throw new Error('DATABASE_URL is required');
}

function connectionStringWithoutSslParameters(databaseUrl) {
    const connectionUrl = new URL(databaseUrl);
    const conflictingParameters = new Set([
        'sslmode', 'ssl', 'require', 'verify-full',
        'sslcert', 'sslkey', 'sslrootcert', 'sslpassword',
    ]);
    for (const parameter of [...connectionUrl.searchParams.keys()]) {
        if (conflictingParameters.has(parameter.toLowerCase())) connectionUrl.searchParams.delete(parameter);
    }
    return connectionUrl.toString();
}

const pool = new Pool({
    connectionString: connectionStringWithoutSslParameters(config.database.url),
    ssl: config.database.ssl,
    max: config.database.max,
    idleTimeoutMillis: config.database.idleTimeoutMillis,
    connectionTimeoutMillis: config.database.connectionTimeoutMillis,
    keepAlive: true,
});

console.log(`[database] environment=${config.environment} sslEnabled=${Boolean(config.database.ssl)}`);

let schemaPromise;

async function initializeDatabase() {
    if (!schemaPromise) {
        const schema = fs.readFileSync(path.join(__dirname, '../../../schema.sql'), 'utf8');
        schemaPromise = pool.query(schema);
    }
    await schemaPromise;
    return pool;
}

async function query(text, values) {
    const database = await initializeDatabase();
    return database.query(text, values);
}

async function withTransaction(callback) {
    const database = await initializeDatabase();
    const client = await database.connect();
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
