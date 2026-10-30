/**
 * migrate-product-urls.js
 *
 * Migrates seo_settings rows from legacy numeric product routes (/product/42)
 * to descriptive slug-based routes (/product/mukhallat-jahara-42).
 *
 * Every statement is idempotent, so this script is safe to re-run on existing
 * databases. It is also reversible: running with --undo restores the legacy
 * numeric route_path values from the product_id column.
 *
 * Usage:
 *   node migrate-product-urls.js          # apply (up)
 *   node migrate-product-urls.js --undo   # revert (down)
 *
 * Environment: DATABASE_URL (or PG* variables) as used by postgres-database.js
 */
import { query, closeDb } from './src/infrastructure/database/postgres-database.js';

const MODE = process.argv.includes('--undo') ? 'undo' : 'up';

async function migrateUp() {
    const products = await query(
        'SELECT id, slug FROM products WHERE slug IS NOT NULL AND TRIM(slug) <> \'\' ORDER BY id ASC'
    );
    console.log(`[migrate-product-urls] Found ${products.rows.length} products with slugs.`);

    const noSlug = await query(
        'SELECT id, name FROM products WHERE slug IS NULL OR TRIM(slug) = \'\' ORDER BY id ASC'
    );
    if (noSlug.rows.length > 0) {
        console.warn(
            `[migrate-product-urls] WARNING: ${noSlug.rows.length} product(s) have no slug and will keep numeric routes:`,
            noSlug.rows.map((r) => `id=${r.id} name=${r.name}`).join(', ')
        );
    }

    let updated = 0;
    let inserted = 0;
    let skipped = 0;
    let conflicts = 0;

    for (const product of products.rows) {
        const { id, slug } = product;
        const oldRoute = `/product/${id}`;
        const newRoute = `/product/${slug}-${id}`;

        const existing = await query(
            'SELECT id, route_path, product_id FROM seo_settings WHERE route_path = $1',
            [newRoute]
        );

        if (existing.rows.length > 0) {
            const existingRow = existing.rows[0];
            if (existingRow.route_path === newRoute) {
                skipped++;
                continue;
            }
            conflicts++;
            console.warn(
                `[migrate-product-urls] CONFLICT: route '${newRoute}' already exists (seo_settings id=${existingRow.id}, product_id=${existingRow.product_id}). Skipping migration for product id=${id}.`
            );
            continue;
        }

        const legacy = await query(
            'SELECT id FROM seo_settings WHERE route_path = $1',
            [oldRoute]
        );

        if (legacy.rows.length > 0) {
            const result = await query(
                `UPDATE seo_settings
                  SET route_path = $1,
                      canonical_url = COALESCE(NULLIF(canonical_url, ''), $2),
                      updated_at = NOW()
                  WHERE route_path = $3
                  RETURNING id`,
                [newRoute, `https://msfragrance.in${newRoute}`, oldRoute]
            );
            if (result.rows.length > 0) {
                updated++;
                console.log(
                    `[migrate-product-urls] Updated seo_settings id=${result.rows[0].id}: '${oldRoute}' → '${newRoute}'`
                );
            } else {
                skipped++;
            }
        } else {
            const result = await query(
                `INSERT INTO seo_settings (
                     page_type, route_path, seo_title, meta_description, canonical_url,
                     robots, og_title, og_description, og_image, twitter_card,
                     twitter_title, twitter_description, twitter_image, structured_data,
                     product_id, is_published
                   ) VALUES (
                     'product', $1, '', '', $2,
                     'index,follow', '', '', '', 'summary_large_image',
                     '', '', '', '{}'::jsonb,
                     $3, TRUE
                   )
                   RETURNING id`,
                [newRoute, `https://msfragrance.in${newRoute}`, id]
            );
            if (result.rows.length > 0) {
                inserted++;
                console.log(
                    `[migrate-product-urls] Inserted seo_settings id=${result.rows[0].id}: '${newRoute}' (product_id=${id})`
                );
            } else {
                skipped++;
            }
        }
    }

    console.log(
        `[migrate-product-urls] UP complete: updated=${updated}, inserted=${inserted}, skipped=${skipped}, conflicts=${conflicts}.`
    );

    if (conflicts > 0) {
        console.warn(
            `[migrate-product-urls] ${conflicts} route conflict(s) were skipped. Resolve manually before re-running.`
        );
    }
}

async function migrateDown() {
    const productSlugs = await query('SELECT id, slug FROM products WHERE slug IS NOT NULL');
    const slugById = new Map();
    for (const p of productSlugs.rows) {
        slugById.set(p.id, p.slug);
    }

    const descriptive = await query(
        "SELECT id, route_path, product_id FROM seo_settings WHERE page_type = 'product' AND route_path LIKE '/product/%-%'"
    );

    let reverted = 0;
    let skipped = 0;

    for (const row of descriptive.rows) {
        const { id: seoId, route_path, product_id } = row;
        const legacyRoute = `/product/${product_id}`;

        const taken = await query(
            'SELECT id FROM seo_settings WHERE route_path = $1 AND id <> $2',
            [legacyRoute, seoId]
        );
        if (taken.rows.length > 0) {
            skipped++;
            console.warn(
                `[migrate-product-urls] SKIP undo for seo_settings id=${seoId}: legacy route '${legacyRoute}' already in use by another row.`
            );
            continue;
        }

        await query(
            'UPDATE seo_settings SET route_path = $1, updated_at = NOW() WHERE id = $2',
            [legacyRoute, seoId]
        );
        reverted++;
        console.log(
            `[migrate-product-urls] Reverted seo_settings id=${seoId}: '${route_path}' → '${legacyRoute}'`
        );
    }

    console.log(
        `[migrate-product-urls] DOWN complete: reverted=${reverted}, skipped=${skipped}.`
    );
}

async function main() {
    try {
        if (MODE === 'undo') {
            await migrateDown();
        } else {
            await migrateUp();
        }
    } catch (error) {
        console.error(`[migrate-product-urls] Failed: ${error.message}`);
        process.exitCode = 1;
    } finally {
        try { await closeDb(); } catch { /* already closed */ }
    }
}

main();