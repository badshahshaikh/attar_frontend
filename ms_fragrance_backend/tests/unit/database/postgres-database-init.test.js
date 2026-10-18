import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresDatabase } from '../../../src/infrastructure/database/postgres-database.js';

function createFakePool({ failHealthCheck = false } = {}) {
    const calls = [];
    return {
        calls,
        async query(text, values) {
            calls.push({ text, values });
            if (failHealthCheck && text === 'SELECT 1') {
                const error = new Error('connection refused');
                error.code = 'ECONNREFUSED';
                throw error;
            }
            return { rows: [{ ok: 1 }] };
        },
        async connect() {
            const clientCalls = [];
            return {
                calls: clientCalls,
                async query(text) {
                    clientCalls.push(text);
                    return { rows: [] };
                },
                release() { },
            };
        },
        async end() {
            calls.push({ text: 'END' });
        },
    };
}

function countHealthChecks(pool) {
    return pool.calls.filter(call => call.text === 'SELECT 1').length;
}

test('initializes once and reuses the warm pool for repeated queries', async () => {
    const pool = createFakePool();
    const database = createPostgresDatabase(pool);

    await database.query('SELECT COUNT(*) FROM products');
    await database.query('SELECT * FROM products LIMIT 1');
    await database.query('SELECT * FROM products LIMIT 1 OFFSET 1');

    assert.equal(countHealthChecks(pool), 1, 'expected a single SELECT 1 health check');
    assert.equal(pool.calls.length, 4, 'expected 1 health check plus 3 business queries');
});

test('concurrent queries share one initialization instead of racing', async () => {
    const pool = createFakePool();
    const database = createPostgresDatabase(pool);

    await Promise.all([
        database.query('SELECT 1-count'),
        database.query('SELECT 2-count'),
        database.query('SELECT 3-count'),
        database.withTransaction(async () => 'ok'),
    ]);

    assert.equal(countHealthChecks(pool), 1, 'concurrent callers must share one health check');
});

test('a failed health check is not cached and the next call retries', async () => {
    let attempts = 0;
    const flakyPool = createFakePool();
    const originalQuery = flakyPool.query.bind(flakyPool);
    flakyPool.query = async (text, values) => {
        if (text === 'SELECT 1') {
            attempts += 1;
            if (attempts === 1) {
                const error = new Error('connection refused');
                error.code = 'ECONNREFUSED';
                throw error;
            }
        }
        return originalQuery(text, values);
    };
    const database = createPostgresDatabase(flakyPool);

    await assert.rejects(() => database.query('SELECT * FROM products'), /connection refused/);
    await database.query('SELECT * FROM products');

    assert.equal(attempts, 2, 'the retry must issue a fresh health check after failure');
});

test('withTransaction still opens, commits, and releases its client', async () => {
    const pool = createFakePool();
    const database = createPostgresDatabase(pool);

    const result = await database.withTransaction(async (client) => {
        await client.query('SELECT 1 FROM products');
        return 'committed';
    });

    assert.equal(result, 'committed');
    assert.equal(countHealthChecks(pool), 1);
});

test('closeDb resets initialization so the next query re-validates', async () => {
    const pool = createFakePool();
    const database = createPostgresDatabase(pool);

    await database.query('SELECT * FROM products');
    await database.closeDb();
    await database.query('SELECT * FROM products');

    assert.equal(countHealthChecks(pool), 2, 'shutdown must clear the warm flag');
});
