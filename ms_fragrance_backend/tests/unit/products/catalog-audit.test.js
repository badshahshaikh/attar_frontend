import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    normalize,
    looseNormalize,
    levenshtein,
    resolveBrand,
    matchProduct,
    findDuplicates,
    buildCatalogAuditRows,
    buildMissingProductsSheet,
    buildExistingProductsSheet,
    buildBrandAuditSheet,
    buildNameVariantsSheet,
    buildJannatulSheet,
    buildAdditionalProductsSheet,
    buildImportReviewSheet,
    buildSummarySheet,
} from '../../../audit-catalog.js';

// ── Fixtures ──────────────────────────────────────────────────────────────
// NOTE: 'Jannatul Firdous' is INTENTIONALLY absent — the real database has no
// such brand, so the audit must report it as a missing brand and never create it.
const BRANDS = [
    { id: 1, name: 'Inspire Fragrances' },
    { id: 2, name: 'Nemat' },
    { id: 3, name: 'SMD Ayyub MD Yaqub' },
    { id: 4, name: 'Surrati' },
];

const PRODUCTS = [
    { id: 101, name: 'Hawas', brand: 'Inspire Fragrances', price: 500 },
    { id: 102, name: 'Khamrah', brand: 'Inspire Fragrances', price: 600 },
    // Duplicate spelling variant of id 102 (case + whitespace) within the SAME brand.
    { id: 103, name: '  khamrah  ', brand: 'inspire fragrances', price: 600 },
    { id: 201, name: 'Majmua', brand: 'Nemat', price: 300 },
    { id: 301, name: 'Mukhallat Ayyub', brand: 'SMD Ayyub MD Yaqub', price: 700 },
    { id: 401, name: 'Imeprial Oud', brand: 'Surrati', price: 800 },
    { id: 402, name: 'Kalimat', brand: 'Surrati', price: 450 },
    // Real-world spelling variant: DB stores 'Mukhallat', requested 'Mukallat'.
    { id: 75, name: 'Mukhallat Emirates', brand: 'Al Haramain', price: 1200 },
];

// Requested catalog fixture. Spellings preserved verbatim, mirroring the real
// REQUESTED_CATALOG in audit-catalog.js (the two proposed brand mappings and the
// empty Jannatul Firdous group).
const CATALOG = [
    {
        brand: 'Inspired Fragrances', // PROPOSED mapping → 'Inspire Fragrances'
        products: ['Hawas', 'Khamrah', 'Blue Oud'], // 'Blue Oud' = not in DB
    },
    {
        brand: 'Nemat', // EXACT brand
        products: ['Majmua', 'Attar Oud'], // 'Majmua' exists, 'Attar Oud' missing
    },
    {
        brand: 'SMD Ayyub Yakub', // PROPOSED mapping → 'SMD Ayyub MD Yaqub'
        products: ['Mukhallat Ayyub'], // exists under the PROPOSED brand
    },
    {
        brand: 'Surrati', // EXACT brand
        products: ['Imeprial Oud', 'Kalimatt'], // 'Kalimatt' ≈ DB 'Kalimat' (variant)
    },
    {
        // No product names supplied — handled on its own sheet only.
        brand: 'Jannatul Firdous', // MISSING brand (not in DB)
        products: [],
    },
];

function groupByBrand(products) {
    const map = new Map();
    for (const p of products) {
        const key = normalize(p.brand);
        if (!key) continue;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(p);
    }
    return map;
}

const GROUPED = groupByBrand(PRODUCTS);

// ── Pure helper tests ─────────────────────────────────────────────────────
test('normalize trims, lowercases and collapses whitespace', () => {
    assert.equal(normalize('  Hawas   Ice '), 'hawas ice');
    assert.equal(normalize(null), '');
    assert.equal(normalize(undefined), '');
});

test('looseNormalize strips punctuation and spaces', () => {
    assert.equal(looseNormalize('REEF 11'), 'reef11');
    assert.equal(looseNormalize('reef-11'), 'reef11');
    assert.equal(looseNormalize("Mukallat Emirates!"), 'mukallatemirates');
});

test('levenshtein measures edit distance', () => {
    assert.equal(levenshtein('kitten', 'sitting'), 3);
    assert.equal(levenshtein('Hawas', 'Hawas'), 0);
    assert.equal(levenshtein('Mukallat', 'Mukhallat'), 1); // insert 'h'
});

// ── Brand resolution: EXACT vs PROPOSED vs MISSING ────────────────────────
test('resolveBrand returns EXACT for a confirmed canonical brand (case-insensitive)', () => {
    const r = resolveBrand('  nemat ', BRANDS);
    assert.equal(r.kind, 'EXACT');
    assert.equal(r.brand.id, 2);
});

test('resolveBrand proposes a mapping for "Inspired Fragrances" → "Inspire Fragrances"', () => {
    const r = resolveBrand('Inspired Fragrances', BRANDS);
    assert.equal(r.kind, 'PROPOSED');
    assert.equal(r.brand.id, 1);
    assert.equal(r.brand.name, 'Inspire Fragrances');
});

test('resolveBrand proposes a mapping for "SMD Ayyub Yakub" → "SMD Ayyub MD Yaqub"', () => {
    const r = resolveBrand('SMD Ayyub Yakub', BRANDS);
    assert.equal(r.kind, 'PROPOSED');
    assert.equal(r.brand.id, 3);
    assert.equal(r.brand.name, 'SMD Ayyub MD Yaqub');
});

test('resolveBrand returns MISSING for a genuinely unknown brand (no false mapping)', () => {
    const r = resolveBrand('Totally Unknown Brand', BRANDS);
    assert.equal(r.kind, 'MISSING');
});

// ── Product matching: exact vs possible, scoped to the SAME brand ─────────
test('matchProduct finds an exact match (case/whitespace-insensitive)', () => {
    const m = matchProduct('majmua ', GROUPED.get('nemat'));
    assert.equal(m.status, 'EXACT');
    assert.equal(m.product.id, 201);
});

test('matchProduct is scoped to the brand — a same-named product in ANOTHER brand is not a match', () => {
    // 'Majmua' exists under Nemat but NOT under Surrati; matching within Surrati
    // must not surface Nemat's record.
    const surrati = GROUPED.get('surrati');
    const m = matchProduct('Majmua', surrati);
    assert.equal(m.status, 'NONE');
    assert.equal(m.possible, null);
});

test('matchProduct reports a possible variant (Kalimatt vs Kalimat) but not an exact match', () => {
    const m = matchProduct('Kalimatt', GROUPED.get('surrati'));
    assert.equal(m.status, 'NONE');
    assert.ok(m.possible, 'a possible variant should be reported');
    assert.equal(m.possible.id, 402);
    assert.equal(m.possible.name, 'Kalimat');
});

test('matchProduct returns no possible match for an unrelated product', () => {
    const m = matchProduct('Blue Oud', GROUPED.get('nemat'));
    assert.equal(m.status, 'NONE');
    assert.equal(m.possible, null);
});

// ── Duplicate detection within a brand ────────────────────────────────────
test('findDuplicates groups case/whitespace variants within one brand', () => {
    const dups = findDuplicates(GROUPED.get('inspire fragrances'));
    assert.equal(dups.length, 1);
    assert.equal(dups[0].count, 2);
    assert.deepEqual(dups[0].ids.sort(), [102, 103]);
});

test('findDuplicates finds nothing when all names are distinct', () => {
    const dups = findDuplicates(GROUPED.get('surrati'));
    assert.equal(dups.length, 0);
});

// ── buildCatalogAuditRows: statuses across brand + product resolution ─────
const AUDIT = buildCatalogAuditRows(CATALOG, BRANDS, GROUPED);

test('audit rows exist for every requested product (empty Jannatul group contributes none)', () => {
    // 3 (Inspired) + 2 (Nemat) + 1 (SMD) + 2 (Surrati) = 8; Jannatul has 0.
    assert.equal(AUDIT.length, 8);
});

test('exact product under exact brand → EXISTS with real ids', () => {
    const r = AUDIT.find((x) => x.requestedBrand === 'Nemat' && x.requestedProduct === 'Majmua');
    assert.equal(r.status, 'EXISTS');
    assert.equal(r.matchType, 'Brand exact');
    assert.equal(r.productId, 201);
    assert.equal(r.brandId, 2);
});

test('missing product under exact brand → MISSING_PRODUCT', () => {
    const r = AUDIT.find((x) => x.requestedBrand === 'Nemat' && x.requestedProduct === 'Attar Oud');
    assert.equal(r.status, 'MISSING_PRODUCT');
    assert.equal(r.matchType, 'Brand exact');
});

test('proposed brand mapping marks existing products as POSSIBLE_NAME_MATCH (not confirmed)', () => {
    const r = AUDIT.find((x) => x.requestedBrand === 'Inspired Fragrances' && x.requestedProduct === 'Hawas');
    assert.equal(r.status, 'POSSIBLE_NAME_MATCH');
    assert.equal(r.matchType, 'Brand mapping proposed');
    assert.equal(r.proposedBrand, 'Inspire Fragrances');
    assert.equal(r.productId, 101);
    assert.match(r.notes, /PROPOSED/i);
});

test('proposed brand mapping with no matching product → AWAITING_BRAND_APPROVAL', () => {
    const r = AUDIT.find((x) => x.requestedBrand === 'Inspired Fragrances' && x.requestedProduct === 'Blue Oud');
    assert.equal(r.status, 'AWAITING_BRAND_APPROVAL');
    assert.equal(r.matchType, 'Brand mapping proposed');
    assert.equal(r.productId, '');
});

test('SMD Ayyub Yakub product under proposed brand is compared but not confirmed', () => {
    const r = AUDIT.find((x) => x.requestedBrand === 'SMD Ayyub Yakub');
    assert.equal(r.matchType, 'Brand mapping proposed');
    assert.equal(r.proposedBrand, 'SMD Ayyub MD Yaqub');
    assert.equal(r.productId, 301);
    assert.match(r.notes, /PROPOSED/i);
});

test('possible name variant under exact brand → POSSIBLE_NAME_MATCH (Kalimatt vs Kalimat)', () => {
    const r = AUDIT.find((x) => x.requestedBrand === 'Surrati' && x.requestedProduct === 'Kalimatt');
    assert.equal(r.status, 'POSSIBLE_NAME_MATCH');
    assert.equal(r.matchType, 'Brand exact');
    assert.equal(r.dbProductName, 'Kalimat');
});

// ── Sheet 2: Missing Products (confirmed brands only) ─────────────────────
test('Missing Products sheet lists only MISSING_PRODUCT rows under confirmed brands', () => {
    const sheet = buildMissingProductsSheet(AUDIT);
    const names = sheet.rows.map((r) => r.requestedProduct);
    assert.ok(names.includes('Attar Oud'), 'Attar Oud (confirmed brand) must be listed');
    // 'Blue Oud' is under a PROPOSED brand, so it must NOT appear here.
    assert.ok(!names.includes('Blue Oud'), 'Blue Oud awaits brand approval, not a confirmed missing product');
});

// ── Sheet 3: Existing Products (exact confirmed matches) ──────────────────
test('Existing Products sheet lists EXISTS rows with real DB ids and brand id', () => {
    const sheet = buildExistingProductsSheet(AUDIT);
    const majmua = sheet.rows.find((r) => r.requestedProduct === 'Majmua');
    assert.equal(majmua.productId, 201);
    assert.equal(majmua.brandId, 2);
    assert.equal(majmua.dbProductName, 'Majmua');
});

// ── Sheet 4: Brand Audit ──────────────────────────────────────────────────
test('Brand Audit sheet marks canonical brands as existing and proposed mappings as unconfirmed', () => {
    const sheet = buildBrandAuditSheet(CATALOG, BRANDS);
    const nemat = sheet.rows.find((r) => r.requestedBrand === 'Nemat');
    assert.equal(nemat.exists, 'Yes');
    assert.equal(nemat.brandId, 2);

    const inspired = sheet.rows.find((r) => r.requestedBrand === 'Inspired Fragrances');
    assert.equal(inspired.exists, 'No');
    assert.match(inspired.proposedMapping, /Inspire Fragrances/);
    assert.match(inspired.reviewNote, /PROPOSED/i);

    const smd = sheet.rows.find((r) => r.requestedBrand === 'SMD Ayyub Yakub');
    assert.equal(smd.exists, 'No');
    assert.match(smd.proposedMapping, /SMD Ayyub MD Yaqub/);
});

// ── Sheet 5: Name Variants (incl. Mukallat/Mukhallat) ─────────────────────
test('Name Variants sheet surfaces possible variants and duplicates with ids', () => {
    const sheet = buildNameVariantsSheet(AUDIT, BRANDS, GROUPED);
    const kalimat = sheet.rows.find((r) => r.dbName === 'Kalimat');
    assert.ok(kalimat, 'Kalimat variant should be listed');
    assert.equal(kalimat.productId, 402);
    // Duplicate detection (khamrah case variant) is included too.
    const dup = sheet.rows.find((r) => r.source === 'Duplicate within brand');
    assert.ok(dup, 'within-brand duplicates should be listed');
});

// ── Sheet 6: Jannatul Firdous ─────────────────────────────────────────────
test('Jannatul sheet reports the brand as missing and does not create it', () => {
    const sheet = buildJannatulSheet('Jannatul Firdous', BRANDS, GROUPED);
    assert.equal(sheet.rows.length, 1);
    assert.equal(sheet.rows[0].brandFound, 'No');
    assert.match(sheet.rows[0].note, /does not exist/i);
    assert.match(sheet.rows[0].note, /No additional product names were supplied/i);
});

// ── Sheet 7: Additional Products (Mukallat Emirates variant) ──────────────
test('Additional Products sheet finds Mukallat Emirates via its real DB record + brand', () => {
    const sheet = buildAdditionalProductsSheet(['Mukallat Emirates'], BRANDS, GROUPED);
    const row = sheet.rows[0];
    assert.notEqual(row.found, 'No', 'a record should be located');
    assert.equal(row.productId, 75);
    assert.equal(row.brand, 'Al Haramain'); // actual DB brand, not inferred from the name
});

test('Additional Products sheet marks a not-found product for review, does not invent it', () => {
    const sheet = buildAdditionalProductsSheet(['Does Not Exist'], BRANDS, GROUPED);
    assert.equal(sheet.rows[0].found, 'No');
    assert.match(sheet.rows[0].note, /not found/i);
});

// ── Sheet 8: Import Review (all pending, no auto-approval) ────────────────
test('Import Review sheet covers missing/awaiting/variant rows and keeps approval PENDING', () => {
    const sheet = buildImportReviewSheet(AUDIT);
    assert.ok(sheet.rows.length > 0, 'there should be import-review candidates');
    assert.ok(sheet.rows.every((r) => r.approvalStatus === 'PENDING'), 'no row may be auto-approved');
    const blueOud = sheet.rows.find((r) => r.requestedProduct === 'Blue Oud');
    assert.match(blueOud.decision, /HOLD/i);
    assert.match(blueOud.proposedMapping, /Inspire Fragrances/);
});

// ── Sheet 9: Summary ──────────────────────────────────────────────────────
test('Summary sheet counts match the classified audit rows', () => {
    const brandAudit = buildBrandAuditSheet(CATALOG, BRANDS).rows;
    const nameVariants = buildNameVariantsSheet(AUDIT, BRANDS, GROUPED).rows;
    const importReview = buildImportReviewSheet(AUDIT).rows;
    const summary = buildSummarySheet(AUDIT, brandAudit, nameVariants, importReview);
    const value = (metric) => summary.rows.find((r) => r.metric.startsWith(metric)).value;

    assert.equal(value('Requested products'), 8);
    assert.equal(value('Exact matches'), 2);            // Majmua + Imeprial Oud
    assert.equal(value('Possible name variants'), 4);   // Hawas, Khamrah, Mukhallat Ayyub, Kalimatt
    assert.equal(value('Confirmed missing products'), 1); // Attar Oud
    assert.equal(value('Products awaiting brand-mapping approval'), 1); // Blue Oud
    assert.equal(value('Missing brands (MISSING_BRAND)'), 0); // Jannatul skipped (0 products)
});

// ── Read-only guarantee: scan SQL query strings for write keywords ────────
test('audit-catalog.js issues only SELECT statements (no write SQL)', () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const src = fs.readFileSync(path.join(__dirname, '../../../audit-catalog.js'), 'utf8');
    // Extract every SQL string literal passed to queryFn(...) and assert each
    // one is a SELECT. Comments may mention write keywords; only real queries count.
    const queryCalls = [...src.matchAll(/query(?:Fn)?\(\s*'([^']*)'/g)];
    assert.ok(queryCalls.length >= 2, 'expected at least brands + products queries');
    for (const [, sql] of queryCalls) {
        assert.match(sql, /^\s*SELECT\b/i, `query must be SELECT: ${sql}`);
        assert.ok(!/\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER)\b/i.test(sql),
            `query must not contain write SQL: ${sql}`);
    }
});