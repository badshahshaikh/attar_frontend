/**
 * migrate-guest-orders.js
 *
 * Guest checkout safety-net migration.
 *
 * The current schema.sql already models guest orders: `orders.user_id` is
 * nullable (ON DELETE SET NULL) and `contact_name`, `contact_phone` and
 * `shipping_address` hold the guest's delivery details. This migration is
 * idempotent and backward-compatible so an older deployed database (where
 * `user_id` may have been created NOT NULL) is brought in line without touching
 * any existing rows or the rest of the schema.
 *
 * What it guarantees:
 *   1. orders.user_id exists, is BIGINT, nullable, and ON DELETE SET NULL.
 *   2. orders.contact_name / contact_phone / shipping_address exist (NOT NULL),
 *      matching the guest fields written by the guest order endpoint.
 *
 * Usage: node migrate-guest-orders.js
 */
import { query, closeDb } from './src/infrastructure/database/postgres-database.js';

async function columnExists(column) {
    const result = await query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = $1`,
        [column]
    );
    return result.rows.length > 0;
}

async function migrate() {
    // 1. Make user_id nullable so a guest order (no account) can be stored.
    //    ALTER COLUMN ... DROP NOT NULL is a no-op when the column is already
    //    nullable, so this is safe to run repeatedly.
    await query('ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL');
    console.log('orders.user_id is nullable');

    // Ensure the FK still cascades a deletion to NULL (keeps history on
    // account removal and lets a guest order have no user_id at all).
    await query(`
        ALTER TABLE public.orders
            DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
        ALTER TABLE public.orders
            ADD CONSTRAINT orders_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
    `);
    console.log('orders.user_id FK set to ON DELETE SET NULL');

    // 2. Ensure the guest delivery columns exist. All are additive and only
    //    applied when missing, so existing databases are never rewritten.
    if (!(await columnExists('contact_name'))) {
        await query("ALTER TABLE public.orders ADD COLUMN contact_name TEXT NOT NULL DEFAULT ''");
        console.log('added orders.contact_name');
    }
    if (!(await columnExists('contact_phone'))) {
        await query("ALTER TABLE public.orders ADD COLUMN contact_phone VARCHAR(20) NOT NULL DEFAULT ''");
        console.log('added orders.contact_phone');
    }
    if (!(await columnExists('shipping_address'))) {
        await query("ALTER TABLE public.orders ADD COLUMN shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb");
        console.log('added orders.shipping_address');
    }

    await closeDb();
}

migrate().catch(async (error) => {
    console.error(`Guest orders migration failed: ${error.message}`);
    try { await closeDb(); } catch { /* already closed */ }
    process.exitCode = 1;
});
