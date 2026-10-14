// Read-only preflight for the catalog-completion run.
// Never writes to the database: only SELECT statements below.
import { query, closeDb } from './src/infrastructure/database/postgres-database.js';
import { config } from './src/config/env.js';
import {
    REQUESTED_CATALOG,
    normalize,
    looseNormalize,
    levenshtein,
} from './audit-catalog.js';

function redactDatabaseTarget(databaseUrl) {
    if (!databaseUrl) return '<not configured>';
    try {
        const url = new URL(databaseUrl);
        const user = url.username ? '<redacted>' : '<none>';
        return `${url.protocol}//${user}:***@${url.host}${url.pathname}`;
    } catch {
        return '<unparseable DATABASE_URL>';
    }
}

// Canonical brand per requested brand name (mappings approved by the operator).
const APPROVED_MAPPINGS = {
    'Inspired Fragrances': 'Inspire Fragrances',
    'SMD Ayyub Yakub': 'SMD Ayyub MD Yaqub',
};

function canonicalBrandFor(requestedBrand) {
    return APPROVED_MAPPINGS[requestedBrand] || requestedBrand;
}

function findByNameLoose(name, products) {
    const target = looseNormalize(name);
    const out = [];
    for (const p of products) {
        const cand = looseNormalize(p.name);
        if (!cand) continue;
        if (cand === target) { out.push({ p, kind: 'loose-exact' }); continue; }
        const d = levenshtein(cand, target);
        const maxLen = Math.max(cand.length, target.length);
        if (maxLen >= 4 && d <= Math.max(1, Math.floor(maxLen * 0.2))) {
            out.push({ p, kind: `lev:${d}` });
        }
    }
    return out;
}

async function main() {
    console.log('=== CATALOG PREFLIGHT (READ-ONLY) ===');
    console.log('environment       :', config.environment);
    console.log('database target   :', redactDatabaseTarget(config.database.url));
    console.log('storage bucket    :', config.storage.bucket, '| supabase url set:', Boolean(config.storage.url), '| key set:', Boolean(config.storage.serviceRoleKey));
    console.log('openai key set    :', Boolean(process.env.OPENAI_API_KEY));

    const brandsRes = await query('SELECT id, name FROM brands ORDER BY id ASC', []);
    const brands = brandsRes.rows;
    const productsRes = await query(
        `SELECT id, name, brand, price, original_price, size_pricing, sizes,
                stock_quantity, in_stock, category, fragrance_type,
                image_url, image_urls, is_new, slug
         FROM products ORDER BY id ASC`,
        []
    );
    const products = productsRes.rows;

    console.log(`\nbrands: ${brands.length} | products: ${products.length}`);
    console.log('--- brands table ---');
    for (const b of brands) console.log(`  ${b.id}: ${b.name}`);

    // Group products by normalized brand text.
    const byBrand = new Map();
    for (const p of products) {
        const key = normalize(p.brand);
        if (!key) continue;
        if (!byBrand.has(key)) byBrand.set(key, []);
        byBrand.get(key).push(p);
    }

    // 1) Duplicate / variant check for each requested product.
    console.log('\n--- requested product checks ---');
    const rows = [];
    for (const group of REQUESTED_CATALOG) {
        const requestedBrand = group.brand;
        const entries = group.products;
        const canonical = canonicalBrandFor(requestedBrand);
        const canonicalKey = normalize(canonical);
        const brandProducts = byBrand.get(canonicalKey) || [];
        const brandId = (brands.find((b) => normalize(b.name) === canonicalKey) || {}).id;
        for (const entry of entries) {
            const name = typeof entry === 'string' ? entry : entry.name;
            const norm = normalize(name);
            const exact = brandProducts.find((p) => normalize(p.name) === norm);
            const looseInBrand = findByNameLoose(name, brandProducts);
            const anywhere = findByNameLoose(name, products).filter(
                ({ p }) => normalize(p.brand) !== canonicalKey
            );
            const status = exact
                ? 'EXISTS_IN_CANONICAL'
                : looseInBrand.length
                    ? 'POSSIBLE_VARIANT_IN_CANONICAL'
                    : anywhere.length
                        ? 'VARIANT_UNDER_OTHER_BRAND'
                        : 'MISSING';
            rows.push({ requestedBrand, canonical, brandId, name, status });
            const detail = [
                exact ? `exact id=${exact.id} price=${exact.price}` : '',
                looseInBrand.length ? `variants=${looseInBrand.map((v) => `${v.p.name}(id=${v.p.id},${v.kind})`).join(';')}` : '',
                anywhere.length ? `elsewhere=${anywhere.map((v) => `${v.p.name}@${v.p.brand}(id=${v.p.id},${v.kind})`).join(';')}` : '',
            ].filter(Boolean).join(' | ');
            console.log(`  [${status}] ${requestedBrand} / ${name}${detail ? ' :: ' + detail : ''}`);
        }
    }

    // 2) Mukhallat Emirates / Mukallat Emirates explicit recheck.
    console.log('\n--- Mukhallat/Mukallat Emirates recheck ---');
    for (const p of products) {
        if (/mukhallat\s*emirates|mukallat\s*emirates/i.test(p.name)) {
            console.log(`  id=${p.id} name="${p.name}" brand="${p.brand}" price=${p.price} sizes=${JSON.stringify(p.sizes)} stock=${p.stock_quantity}`);
        }
    }

    // 3) Price / size patterns of existing products under the four target brands.
    console.log('\n--- existing price patterns per target brand ---');
    for (const group of REQUESTED_CATALOG) {
        const requestedBrand = group.brand;
        const canonical = canonicalBrandFor(requestedBrand);
        const list = byBrand.get(normalize(canonical)) || [];
        console.log(`  ${canonical} (requested as "${requestedBrand}"): ${list.length} existing products`);
        for (const p of list.slice(0, 25)) {
            console.log(`    id=${p.id} "${p.name}" price=${p.price} original=${p.original_price} sizes=${JSON.stringify(p.sizes)} sizePricing=${JSON.stringify(p.size_pricing)} stock=${p.stock_quantity} inStock=${p.in_stock} cat=${p.category} frag=${p.fragrance_type} img=${p.image_url ? 'yes' : 'no'}`);
        }
        if (list.length > 25) console.log(`    ... ${list.length - 25} more`);
        const priceSet = [...new Set(list.map((p) => String(p.price)))];
        console.log(`    distinct prices: ${priceSet.join(', ') || '<none>'}`);
    }

    // 4) Summary counts.
    const counts = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
    console.log('\n--- summary ---');
    console.log(JSON.stringify(counts, null, 2));
    const eligible = rows.filter((r) => r.status === 'MISSING');
    console.log('eligible (missing, no variant anywhere):', eligible.length);

    await closeDb();
}

main().catch(async (err) => {
    console.error('PREFLIGHT ERROR:', err.message);
    await closeDb().catch(() => {});
    process.exitCode = 1;
});

