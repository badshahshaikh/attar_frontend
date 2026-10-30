/**
 * populate-product-slugs.js
 *
 * Populates missing products.slug values from product names.
 * Generates URL-friendly slugs: lowercase, spaces -> hyphens,
 * punctuation removed, repeated hyphens collapsed.
 *
 * Every statement is idempotent: existing non-empty slugs are preserved.
 * Duplicate names are disambiguated by appending the numeric id
 * (slugs are always used with -{id} in URLs, so slug+id is unique).
 *
 * Usage:
 *   node populate-product-slugs.js          # dry-run preview (no DB changes)
 *   node populate-product-slugs.js --apply  # apply changes to database
 *   node populate-product-slugs.js --undo   # revert: set slugs back to NULL
 *
 * Environment: DATABASE_URL (as used by postgres-database.js)
 */
import { query, closeDb } from './src/infrastructure/database/postgres-database.js';

const APPLY = process.argv.includes('--apply');
const UNDO = process.argv.includes('--undo');

function slugify(name) {
    let s = String(name).trim().toLowerCase();
    s = s.replace(/[^a-z0-9\s-]/g, '');
    s = s.replace(/\s+/g, '-');
    s = s.replace(/-+/g, '-');
    s = s.replace(/^-+|-+$/, '');
    return s || null;
}

async function fetchProducts() {
    return (await query('SELECT id, name, slug FROM products ORDER BY id ASC')).rows;
}

async function dryRun() {
    const rows = await fetchProducts();
    const missing = rows.filter((r) => !r.slug || String(r.slug).trim() === '');
    const existing = rows.filter((r) => r.slug && String(r.slug).trim() !== '');

    console.log('[populate-product-slugs] DRY RUN — no database changes will be made');
    console.log(`[populate-product-slugs] Total products: ${rows.length}`);
    console.log(`[populate-product-slugs] Already have slugs: ${existing.length}`);
    console.log(`[populate-product-slugs] Missing slugs: ${missing.length}`);
    console.log();

    if (existing.length > 0) {
        console.log('[populate-product-slugs] Preserving existing slugs:');
        for (const r of existing) {
            console.log(`  id=${r.id} | name=${r.name} | slug=${r.slug}`);
        }
        console.log();
    }

    if (missing.length > 0) {
        console.log('[populate-product-slugs] Proposed slug changes:');
        for (const r of missing) {
            const slug = slugify(r.name);
            console.log(
                `  id=${r.id} | name=${r.name} | slug=NULL -> '${slug}' | URL: /product/${slug}-${r.id}`
            );
        }
        console.log();
        console.log('[populate-product-slugs] Run with --apply to persist these changes.');
    } else {
        console.log('[populate-product-slugs] All products already have slugs. Nothing to do.');
    }
}

async function apply() {
    const rows = await fetchProducts();
    let updated = 0;
    let skipped = 0;

    for (const r of rows) {
        if (r.slug && String(r.slug).trim() !== '') {
            skipped++;
            continue;
        }

        const slug = slugify(r.name);
        if (!slug) {
            console.warn(
                `[populate-product-slugs] SKIP id=${r.id}: unable to generate slug from name '${r.name}'`
            );
            skipped++;
            continue;
        }

        await query('UPDATE products SET slug = $1, updated_at = NOW() WHERE id = $2', [slug, r.id]);
        updated++;
        console.log(
            `[populate-product-slugs] Updated id=${r.id}: name='${r.name}' -> slug='${slug}'`
        );
    }

    console.log(
        `[populate-product-slugs] APPLY complete: updated=${updated}, skipped=${skipped}.`
    );
}

async function undo() {
    const rows = await fetchProducts();
    const withSlugs = rows.filter((r) => r.slug && String(r.slug).trim() !== '');
    let reverted = 0;

    for (const r of withSlugs) {
        await query('UPDATE products SET slug = NULL, updated_at = NOW() WHERE id = $2', [r.id]);
        reverted++;
        console.log(
            `[populate-product-slugs] Reverted id=${r.id}: slug='${r.slug}' -> NULL`
        );
    }

    console.log(`[populate-product-slugs] UNDO complete: reverted=${reverted}.`);
}

async function main() {
    try {
        if (UNDO) {
            await undo();
        } else if (APPLY) {
            await apply();
        } else {
            await dryRun();
        }
    } catch (error) {
        console.error(`[populate-product-slugs] Failed: ${error.message}`);
        process.exitCode = 1;
    } finally {
        try { await closeDb(); } catch { /* already closed */ }
    }
}

main();
