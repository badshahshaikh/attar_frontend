import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Static verification of migrate-returns.js against schema.sql (the source of
// truth for the table structure). The migration is never executed here — it is
// inspected so the suite proves it is safe to re-run on an existing database
// without touching the real PostgreSQL instance.
const backendRoot = new URL('../../../', import.meta.url);
const migrationSource = readFileSync(fileURLToPath(new URL('migrate-returns.js', backendRoot)), 'utf8');
const schemaSource = readFileSync(fileURLToPath(new URL('schema.sql', backendRoot)), 'utf8');
const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('package.json', backendRoot)), 'utf8'));

const RETURN_TABLES = ['returns', 'return_items', 'return_status_history', 'return_refunds'];

// Extracts the parenthesised body of `CREATE TABLE IF NOT EXISTS <name>` with
// balanced-paren scanning so nested CHECK (...) constraints stay inside.
function extractCreateTableBody(source, name) {
    const marker = `CREATE TABLE IF NOT EXISTS ${name}`;
    const at = source.indexOf(marker);
    assert.ok(at >= 0, `${marker} present`);
    const open = source.indexOf('(', at + marker.length);
    assert.ok(open >= 0, `${name} has a column list`);

    let depth = 0;
    for (let i = open; i < source.length; i++) {
        if (source[i] === '(') depth += 1;
        else if (source[i] === ')') {
            depth -= 1;
            if (depth === 0) return source.slice(open + 1, i);
        }
    }
    throw new Error(`Unbalanced parentheses in CREATE TABLE ${name}`);
}

const normalizeSql = (sql) => sql.replace(/\s+/g, ' ').trim();

test('migrate-returns adds orders.delivered_at idempotently', () => {
    assert.match(
        migrationSource,
        /ALTER TABLE public\.orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ/,
        'the delivery timestamp column is added only when missing'
    );
});

test('migrate-returns creates all four return tables with IF NOT EXISTS', () => {
    for (const table of RETURN_TABLES) {
        assert.ok(
            migrationSource.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
            `${table} is created idempotently`
        );
    }
});

test('migrate-returns table definitions match schema.sql (the source of truth)', () => {
    for (const table of RETURN_TABLES) {
        assert.equal(
            normalizeSql(extractCreateTableBody(migrationSource, table)),
            normalizeSql(extractCreateTableBody(schemaSource, table)),
            `${table} structure must not drift from schema.sql`
        );
    }
});

test('migrate-returns statements are safe to re-run (idempotent DDL, no destructive statements)', () => {
    const creates = [...migrationSource.matchAll(/CREATE\s+(TABLE|INDEX)\s+(IF NOT EXISTS\s+)?/gi)];
    assert.ok(creates.length > 0, 'the migration contains CREATE statements');
    for (const match of creates) {
        assert.ok(match[2], `missing IF NOT EXISTS: ${match[0].trim()}`);
    }

    const alters = [...migrationSource.matchAll(/ALTER\s+TABLE\s+\S+\s+ADD\s+COLUMN\s+(IF NOT EXISTS\s+)?/gi)];
    assert.ok(alters.length > 0, 'the migration contains an ALTER TABLE ADD COLUMN');
    for (const match of alters) {
        assert.ok(match[1], `missing IF NOT EXISTS: ${match[0].trim()}`);
    }

    // No statement may drop or wipe existing data. (FK clauses such as
    // "ON DELETE CASCADE" are fine; "DELETE FROM" is not.)
    assert.ok(!/\bDROP\s+TABLE\b/i.test(migrationSource), 'no DROP TABLE');
    assert.ok(!/\bDROP\s+DATABASE\b/i.test(migrationSource), 'no DROP DATABASE');
    assert.ok(!/\bTRUNCATE\b/i.test(migrationSource), 'no TRUNCATE');
    assert.ok(!/\bDELETE\s+FROM\b/i.test(migrationSource), 'no DELETE FROM');
});

test('migrate-returns backfills delivered_at only where it is still NULL', () => {
    assert.match(
        migrationSource,
        /WHERE status = 'delivered' AND delivered_at IS NULL/,
        'the backfill never overwrites an existing delivery timestamp (first stamp wins on re-runs)'
    );
    assert.match(
        migrationSource,
        /SET delivered_at = COALESCE\(updated_at, created_at\)/,
        'the backfill derives the timestamp without touching any other column'
    );
});

test('migrate-returns fails loudly instead of reporting false success', () => {
    assert.match(migrationSource, /migrate\(\)\.catch\(/, 'the migration promise is caught');
    assert.match(migrationSource, /process\.exitCode = 1/, 'a failed statement sets a failing exit code');
});

test('package.json keeps the migrate:returns script', () => {
    assert.equal(packageJson.scripts['migrate:returns'], 'node migrate-returns.js');
});