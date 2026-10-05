/**
 * migrate-user-role-default.js
 *
 * Phase 0 security fix.
 *
 * The `users.role` column defaulted to 'admin', so any INSERT that omitted a
 * role silently created an administrator. This flips the database default to
 * 'customer'.
 *
 * Existing rows are deliberately left untouched: every admin created through
 * `create-admin.js` was explicitly assigned the 'admin' role, so this only
 * changes the default applied to future inserts.
 *
 * Usage: node migrate-user-role-default.js
 */
import { query, closeDb } from './src/infrastructure/database/postgres-database.js';

const READ_DEFAULT = `
    SELECT column_default
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role'
`;

async function migrate() {
    const before = await query(READ_DEFAULT);
    console.log('role default before:', before.rows[0] ? before.rows[0].column_default : 'unknown');

    await query("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'customer'");

    const after = await query(READ_DEFAULT);
    console.log('role default after:', after.rows[0] ? after.rows[0].column_default : 'unknown');

    const roles = await query(
        'SELECT role, COUNT(*)::int AS count FROM users GROUP BY role ORDER BY role'
    );
    console.log('existing roles:', JSON.stringify(roles.rows));

    await closeDb();
}

migrate().catch(async error => {
    console.error(`Role default migration failed: ${error.message}`);
    try { await closeDb(); } catch { /* already closed */ }
    process.exitCode = 1;
});