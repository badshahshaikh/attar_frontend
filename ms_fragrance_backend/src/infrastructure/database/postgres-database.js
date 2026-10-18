import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!config.database.url) {
    throw new Error('DATABASE_URL is required');
}

function connectionStringWithoutSslParameters(databaseUrl) {
    const connectionUrl = new URL(databaseUrl);

    const conflictingParameters = new Set([
        'sslmode',
        'ssl',
        'require',
        'verify-full',
        'sslcert',
        'sslkey',
        'sslrootcert',
        'sslpassword',
    ]);

    for (const parameter of [...connectionUrl.searchParams.keys()]) {
        if (conflictingParameters.has(parameter.toLowerCase())) {
            connectionUrl.searchParams.delete(parameter);
        }
    }

    return connectionUrl.toString();
}

const pool = new Pool({
    connectionString: connectionStringWithoutSslParameters(
        config.database.url
    ),
    ssl: config.database.ssl,
    max: config.database.max,
    idleTimeoutMillis: config.database.idleTimeoutMillis,
    connectionTimeoutMillis: config.database.connectionTimeoutMillis,
    keepAlive: true,
});

pool.on('error', (error) => {
    console.error('[PG_POOL_ERROR]', {
        message: error.message,
        code: error.code,
        stack: error.stack,
    });
});

console.log(
    `[database] environment=${config.environment} sslEnabled=${Boolean(
        config.database.ssl
    )}`
);

function createPostgresDatabase(poolInstance) {
    let initializationPromise = null;

    async function initializeDatabase() {
        if (initializationPromise) {
            return initializationPromise;
        }

        initializationPromise = (async () => {
            try {
                await poolInstance.query('SELECT 1');

                console.log('[database] connection established');

                return poolInstance;
            } catch (error) {
                initializationPromise = null;

                console.error('[database] connection failed', {
                    message: error.message,
                    code: error.code,
                    stack: error.stack,
                });

                throw error;
            }
        })();

        return initializationPromise;
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
        initializationPromise = null;
        await poolInstance.end();
    }

    return {
        initializeDatabase,
        query,
        withTransaction,
        closeDb,
    };
}

const defaultDatabase = createPostgresDatabase(pool);

const initializeDatabase = defaultDatabase.initializeDatabase;
const query = defaultDatabase.query;
const withTransaction = defaultDatabase.withTransaction;
const closeDb = defaultDatabase.closeDb;

export {
    createPostgresDatabase,
    initializeDatabase,
    query,
    withTransaction,
    closeDb,
};

export default {
    createPostgresDatabase,
    initializeDatabase,
    query,
    withTransaction,
    closeDb,
};