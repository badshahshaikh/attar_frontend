#!/usr/bin/env node
/**
 * audit-catalog.js
 *
 * One-time, READ-ONLY product catalog audit + safe Excel import-review export
 * for MS Fragrance.
 *
 * What it does:
 *   1. Connects with the project's existing Postgres configuration.
 *   2. Runs read-only SELECTs to fetch every brand and product.
 *   3. Matches the supplied catalog against the database (case-insensitive,
 *      whitespace-trimmed, whitespace-collapsed) and classifies each row.
 *   4. Writes a professional, multi-sheet .xlsx audit + import-review workbook.
 *
 * Safety guarantees:
 *   - Only SELECT statements are issued. No INSERT/UPDATE/DELETE/DDL.
 *   - The database target is printed WITHOUT ever exposing the connection
 *     string, password or any secret.
 *   - The output filename is timestamped so an existing report is never
 *     overwritten.
 *   - No AI APIs, no image generation, no product creation, no brand creation.
 *   - Proposed brand mappings are shown for confirmation only — never applied.
 *
 * Relationship note (verified against schema.sql):
 *   products.brand is a free-text column (NOT a foreign key). The separate
 *   `brands` table (id, name UNIQUE) holds the managed brand list. A product
 *   belongs to a brand by its `brand` text matching brands.name. This script
 *   therefore matches on normalized text and never assumes a FK join.
 *
 * Usage:  node audit-catalog.js      (or: npm run audit:catalog)
 * Requires: exceljs (already a project dependency).
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { config } from './src/config/env.js';
import { query, closeDb } from './src/infrastructure/database/postgres-database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── The nine existing brands shown in the admin panel (canonical list) ────
// Used as the authoritative existing-brand list when matching DB records.
// These names are NOT renamed. Matching against them is case-insensitive.
export const EXISTING_BRAND_NAMES = [
    'Al Haramain',
    'Anfar',
    'Inspired Fragrances',
    'MS Fragrance Exclusive',
    'Nemat',
    'SH Kelkar',
    'SMD Ayyub MD Yaqub',
    'Surrati',
    'Swiss Arabian',
];

// ── Supplied catalog (authoritative input; spellings preserved verbatim) ──
// Spelling and brand groupings are kept EXACTLY as supplied. Mismatches are
// surfaced for human review instead of being silently corrected.
export const REQUESTED_CATALOG = [
    {
        brand: 'Inspired Fragrances',
        products: [
            'Hawas', 'Hawas Ice', 'Hawas Fire', 'Khamrah', 'Khamrah Waha',
            'Khamraha Qahwa', 'Khamra Dukhan', 'Marj', 'Bin Shaikh', 'Kaaf',
            'Zumar', 'Rawdah', 'Kiswa', 'Rose Noir', 'REEF 11', 'REEF 19',
            'REEF 33', 'Brazilian Tobacco', 'Mexican Tobacco', 'Cuban Tobacco',
            'Blue Oud', 'Imperial Valley',
        ],
    },
    {
        brand: 'Nemat',
        products: ['Majmua', 'Attar Oud', 'Shahi Khus', 'Shahi Kewda'],
    },
    {
        brand: 'SMD Ayyub MD Yaqub',
        products: [
            'Mukhallat Ayyub', 'Mukhallat Suyufi', 'Mukhallat Rayyan',
            'Mukhallat Humaira', 'Mohsin SHAMAMA', 'Ruh Khus No 1', 'Gulaab',
            'Lilly', 'Jasmine', 'Bela',
        ],
    },
    {
        brand: 'Surrati',
        products: [
            'Imeprial Oud', 'Kalimat', 'Musky Rose', 'Baccart Rouge',
            'Ehsas Al Arabia', 'Zam Zam', 'Al Hajr', 'Rooh Al Musk',
            'Oud Interloge', 'Perfume DFL', 'Musk Mutasalliq',
        ],
    },
    {
        // Supplied WITHOUT individual product names — audited from the DB only.
        brand: 'Jannatul Firdous',
        products: [],
    },
];

// Brand handled on its own worksheet with no supplied product names.
const JANNATUL_FIRDOUS = 'Jannatul Firdous';

// Additional product to verify against the real DB record.
const ADDITIONAL_PRODUCTS = ['Mukallat Emirates'];

// ── Pure helpers (no DB / no Excel — fully unit-testable) ─────────────────

/** Trim + lowercase + collapse repeated internal whitespace. */
export function normalize(value) {
    return String(value == null ? '' : value)
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

/** Aggressive form for detecting spacing/punctuation-only differences. */
export function looseNormalize(value) {
    return normalize(value).replace(/[^a-z0-9]/g, '');
}

/** Classic Levenshtein edit distance (bounded, small inputs only). */
export function levenshtein(a, b) {
    const s = normalize(a);
    const t = normalize(b);
    if (s === t) return 0;
    if (!s.length) return t.length;
    if (!t.length) return s.length;

    let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
    for (let i = 1; i <= s.length; i += 1) {
        const cur = [i];
        for (let j = 1; j <= t.length; j += 1) {
            const cost = s[i - 1] === t[j - 1] ? 0 : 1;
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        }
        prev = cur;
    }
    return prev[t.length];
}

// Resolve a requested brand name against the canonical brand list.
// Returns one of:
//   { kind: 'EXACT',    brand }                       // exact normalized match
//   { kind: 'PROPOSED', brand, distance }             // close variant → mapping to confirm
//   { kind: 'MISSING',  suggested }                   // no acceptable candidate
//
// `suggested` is the single closest candidate (if any) purely to make the review
// note actionable. A PROPOSED mapping is NEVER treated as confirmed: the caller
// must keep product matching under the *requested* name until it is approved.
export function resolveBrand(requestedName, brands) {
    const target = normalize(requestedName);
    const exact = brands.find((b) => normalize(b.name) === target);
    if (exact) return { kind: 'EXACT', brand: exact };

    // Propose the closest candidate when it is reasonably similar: loose
    // (punctuation/space-insensitive) equality, or an edit distance within a
    // relative bound. Conservative so genuinely different names are not merged.
    const threshold = Math.max(2, Math.round(target.length * 0.4));
    let best = null;
    let bestDist = Infinity;
    for (const b of brands) {
        const sameLoose = looseNormalize(b.name) === looseNormalize(requestedName);
        const dist = levenshtein(requestedName, b.name);
        if ((sameLoose || dist <= threshold) && dist < bestDist) {
            best = b;
            bestDist = dist;
        }
    }
    if (best) return { kind: 'PROPOSED', brand: best, distance: bestDist };
    return { kind: 'MISSING', suggested: null };
}

// Find a product within a specific brand's products (by normalized name).
// Distinguishes an EXACT match from a POSSIBLE (near) variant; never treats the
// same name under a different brand as the same record.
export function matchProduct(requestedName, brandProducts) {
    const target = normalize(requestedName);
    const exact = brandProducts.find((p) => normalize(p.name) === target);
    if (exact) return { status: 'EXACT', product: exact, possible: null };

    // Possible name match only within the SAME brand, using loose equality or a
    // very small edit distance. Kept deliberately conservative so two genuinely
    // different products are never declared identical.
    let possible = null;
    for (const p of brandProducts) {
        const sameLoose = looseNormalize(p.name) === looseNormalize(requestedName);
        const dist = levenshtein(requestedName, p.name);
        if (sameLoose || (dist <= 1 && target.length >= 4)) {
            if (!possible || dist < levenshtein(requestedName, possible.name)) {
                possible = p;
            }
        }
    }
    return { status: 'NONE', product: null, possible };
}

// Detect potential duplicate product records WITHIN a brand: two or more rows
// whose names are equal after normalization (or loose-normalization). Returns
// an array of { key, name, count, ids, names }.
export function findDuplicates(brandProducts) {
    const byLoose = new Map();
    for (const p of brandProducts) {
        const key = looseNormalize(p.name);
        if (!key) continue;
        if (!byLoose.has(key)) byLoose.set(key, []);
        byLoose.get(key).push(p);
    }
    const dups = [];
    for (const [, group] of byLoose) {
        // A duplicate is two+ rows that collapse to the same loose name.
        if (group.length > 1) {
            dups.push({
                key: looseNormalize(group[0].name),
                names: group.map((p) => p.name),
                ids: group.map((p) => p.id),
                count: group.length,
            });
        }
    }
    return dups;
}

// Build the Catalog Audit rows from fetched DB data. Pure + testable.
// Produces the full column set required by Sheet 1 and drives the other sheets.
export function buildCatalogAuditRows(catalog, brands, productsByBrand) {
    const rows = [];
    for (const group of catalog) {
        const resolution = resolveBrand(group.brand, brands);
        // Product matching is ALWAYS scoped to the resolved brand. For a
        // PROPOSED mapping the products are compared against the proposed brand
        // but the status reflects that the mapping is not yet approved.
        const resolvedBrand = resolution.kind === 'EXACT' || resolution.kind === 'PROPOSED'
            ? resolution.brand
            : null;
        const brandProducts = resolvedBrand
            ? productsByBrand.get(normalize(resolvedBrand.name)) || []
            : [];

        // A brand supplied with no products is handled on its own sheet.
        if (!group.products.length) {
            continue;
        }

        for (const requestedName of group.products) {
            const pm = resolvedBrand
                ? matchProduct(requestedName, brandProducts)
                : { status: 'NONE', product: null, possible: null };

            let matchType;       // how the brand resolved
            let status;          // audit status
            let notes = '';
            let dbProductName = '';
            let productId = '';
            const brandId = resolvedBrand ? resolvedBrand.id : '';
            const proposedBrand = resolution.kind === 'PROPOSED' ? resolvedBrand.name : '';
            const dbBrandName = resolvedBrand ? resolvedBrand.name : '';

            if (resolution.kind === 'MISSING') {
                matchType = 'Brand missing';
                status = 'MISSING_BRAND';
                notes = `Brand "${group.brand}" does not exist in the database.`;
            } else if (resolution.kind === 'PROPOSED') {
                matchType = 'Brand mapping proposed';
                // Products are compared under the proposed brand but are NOT
                // considered confirmed until the mapping is approved.
                if (pm.status === 'EXACT') {
                    status = 'POSSIBLE_NAME_MATCH';
                    dbProductName = pm.product.name;
                    productId = pm.product.id;
                    notes = `Brand mapping PROPOSED (not confirmed): "${group.brand}" → "${resolvedBrand.name}" (id ${resolvedBrand.id}). A product "${pm.product.name}" (id ${pm.product.id}) exists under the proposed brand. Confirm the mapping before treating this as an exact match.`;
                } else if (pm.possible) {
                    status = 'AWAITING_BRAND_APPROVAL';
                    dbProductName = pm.possible.name;
                    productId = pm.possible.id;
                    notes = `Brand mapping PROPOSED (not confirmed): "${group.brand}" → "${resolvedBrand.name}" (id ${resolvedBrand.id}). Closest product under proposed brand: "${pm.possible.name}" (id ${pm.possible.id}). Confirm mapping before any action.`;
                } else {
                    status = 'AWAITING_BRAND_APPROVAL';
                    notes = `Brand mapping PROPOSED (not confirmed): "${group.brand}" → "${resolvedBrand.name}" (id ${resolvedBrand.id}). No product "${requestedName}" found under the proposed brand yet.`;
                }
            } else {
                // EXACT brand
                matchType = 'Brand exact';
                if (pm.status === 'EXACT') {
                    status = 'EXISTS';
                    dbProductName = pm.product.name;
                    productId = pm.product.id;
                    if (normalize(pm.product.name) !== normalize(requestedName)) {
                        notes = `Exact (normalized) match; stored spelling differs: "${pm.product.name}".`;
                    }
                } else if (pm.possible) {
                    status = 'POSSIBLE_NAME_MATCH';
                    dbProductName = pm.possible.name;
                    productId = pm.possible.id;
                    notes = `No exact match. Possible variant under "${resolvedBrand.name}": "${pm.possible.name}" (id ${pm.possible.id}). Review spelling — do not auto-merge.`;
                } else {
                    status = 'MISSING_PRODUCT';
                    notes = `No product "${requestedName}" found under confirmed brand "${resolvedBrand.name}".`;
                }
            }

            rows.push({
                requestedBrand: group.brand,
                requestedProduct: requestedName,
                proposedBrand,
                brandId,
                dbBrandName,
                dbProductName,
                productId,
                matchType,
                status,
                notes,
            });
        }
    }
    return rows;
}

// ── Sheet data builders (pure; return { headers, rows }) ──────────────────

// Sheet 2: Missing Products — only products missing under a CONFIRMED brand.
// Products awaiting brand-mapping approval are NOT listed here (separate status).
export function buildMissingProductsSheet(auditRows) {
    const rows = auditRows
        .filter((r) => r.status === 'MISSING_PRODUCT')
        .map((r) => ({
            requestedBrand: r.requestedBrand,
            requestedProduct: r.requestedProduct,
            brandId: r.brandId,
            dbBrandName: r.dbBrandName,
            reason: `No product "${r.requestedProduct}" found under confirmed brand "${r.dbBrandName}".`,
        }));
    return {
        headers: ['Requested Brand', 'Requested Product Name', 'Brand ID', 'Database Brand Name', 'Reason Missing'],
        rows,
    };
}

// Sheet 3: Existing Products — exact (confirmed) matches only.
export function buildExistingProductsSheet(auditRows) {
    const rows = auditRows
        .filter((r) => r.status === 'EXISTS')
        .map((r) => ({
            requestedBrand: r.requestedBrand,
            requestedProduct: r.requestedProduct,
            dbProductName: r.dbProductName,
            productId: r.productId,
            brandId: r.brandId,
            dbBrandName: r.dbBrandName,
        }));
    return {
        headers: ['Requested Brand', 'Requested Product Name', 'Database Product Name', 'Product ID', 'Brand ID', 'Database Brand Name'],
        rows,
    };
}

// Sheet 4: Brand Audit — all nine canonical brands PLUS the requested brands.
// Shows existence and any proposed mapping needing confirmation.
export function buildBrandAuditSheet(catalog, brands) {
    const byName = new Map(brands.map((b) => [normalize(b.name), b]));
    const rows = [];
    const seen = new Set();

    const addRow = (requestedName, source) => {
        const key = normalize(requestedName);
        if (seen.has(key)) return;
        seen.add(key);

        const exact = byName.get(key);
        if (exact) {
            rows.push({
                requestedBrand: requestedName,
                source,
                exists: 'Yes',
                brandId: exact.id,
                dbBrandName: exact.name,
                proposedMapping: '',
                reviewNote: '',
            });
            return;
        }
        const res = resolveBrand(requestedName, brands);
        if (res.kind === 'PROPOSED') {
            rows.push({
                requestedBrand: requestedName,
                source,
                exists: 'No',
                brandId: '',
                dbBrandName: '',
                proposedMapping: `${requestedName} → ${res.brand.name} (id ${res.brand.id})`,
                reviewNote: 'PROPOSED mapping — requires confirmation. Not applied automatically.',
            });
        } else {
            rows.push({
                requestedBrand: requestedName,
                source,
                exists: 'No',
                brandId: '',
                dbBrandName: '',
                proposedMapping: '',
                reviewNote: 'Brand does not exist. Requires review — not created.',
            });
        }
    };

    // Canonical nine first (so their presence is explicit), then requested brands.
    for (const name of EXISTING_BRAND_NAMES) addRow(name, 'Canonical');
    for (const group of catalog) addRow(group.brand, 'Requested');

    return {
        headers: ['Requested Brand', 'Source', 'Brand Exists', 'Brand ID', 'Database Brand Name', 'Proposed Mapping', 'Review Notes'],
        rows,
    };
}

// Sheet 5: Name Variants — potential product-name spelling variants, drawn from
// (a) audit rows flagged POSSIBLE_NAME_MATCH and (b) duplicate detection within
// each brand. Includes record IDs and brand names. Never auto-merged.
export function buildNameVariantsSheet(auditRows, brands, productsByBrand) {
    const rows = [];

    // (a) Possible variants found during catalog matching.
    for (const r of auditRows) {
        if (r.status === 'POSSIBLE_NAME_MATCH' && r.dbProductName) {
            rows.push({
                requestedName: r.requestedProduct,
                dbName: r.dbProductName,
                productId: r.productId,
                brandName: r.dbBrandName || r.proposedBrand,
                source: 'Catalog match',
                note: 'Requested name differs from a database record. Review — not auto-corrected.',
            });
        }
    }

    // (b) Duplicate records within a brand.
    for (const [, list] of productsByBrand) {
        const dups = findDuplicates(list);
        for (const d of dups) {
            rows.push({
                requestedName: d.names.join(' / '),
                dbName: d.names.join(' / '),
                productId: d.ids.join(', '),
                brandName: list[0] && list[0].brand ? list[0].brand : '',
                source: 'Duplicate within brand',
                note: `${d.count} records collapse to the same name. Review before importing.`,
            });
        }
    }

    return {
        headers: ['Requested Name', 'Database Name(s)', 'Product ID(s)', 'Brand Name', 'Source', 'Note'],
        rows,
    };
}

// Sheet 6: Jannatul Firdous — existing DB products under this brand if found.
export function buildJannatulSheet(brandName, brands, productsByBrand) {
    const res = resolveBrand(brandName, brands);
    const rows = [];
    if (res.kind === 'EXACT') {
        const products = productsByBrand.get(normalize(res.brand.name)) || [];
        for (const p of products) {
            rows.push({
                productId: p.id,
                dbProductName: p.name,
                brandId: res.brand.id,
                brandFound: 'Yes',
                note: 'Existing product found under this brand.',
            });
        }
        if (!products.length) {
            rows.push({
                productId: '',
                dbProductName: '',
                brandId: res.brand.id,
                brandFound: 'Yes',
                note: 'Brand exists but has no products in the database. No additional product names were supplied.',
            });
        }
    } else if (res.kind === 'PROPOSED') {
        rows.push({
            productId: '',
            dbProductName: '',
            brandId: '',
            brandFound: 'No (proposed: ' + res.brand.name + ')',
            note: `Brand "${brandName}" not found. Closest DB brand: "${res.brand.name}" (id ${res.brand.id}). No additional product names were supplied.`,
        });
    } else {
        rows.push({
            productId: '',
            dbProductName: '',
            brandId: '',
            brandFound: 'No',
            note: `Brand "${brandName}" does not exist in the database. Requires review — not created. No additional product names were supplied.`,
        });
    }
    return {
        headers: ['Product ID', 'Database Product Name', 'Brand ID', 'Brand Found', 'Note'],
        rows,
    };
}

// Sheet 7: Additional Products — the actual DB record for each additional
// product (e.g. Mukallat Emirates), including possible spelling variants.
export function buildAdditionalProductsSheet(names, brands, productsByBrand) {
    const rows = [];
    for (const name of names) {
        // Exact search across ALL brands first.
        let found = null;
        let possible = null;
        for (const [, list] of productsByBrand) {
            const pm = matchProduct(name, list);
            if (pm.status === 'EXACT') { found = pm.product; break; }
            if (!possible && pm.possible) possible = pm.possible;
        }
        const hit = found || possible;
        if (hit) {
            rows.push({
                requestedName: name,
                found: found ? 'Exact' : 'Possible variant',
                productId: hit.id,
                dbProductName: hit.name,
                brand: hit.brand,
                note: found
                    ? 'Exact database record located.'
                    : `Possible spelling variant located (id ${hit.id}). Verify before importing — do not create a duplicate.`,
            });
        } else {
            rows.push({
                requestedName: name,
                found: 'No',
                productId: '',
                dbProductName: '',
                brand: '',
                note: 'Not found in the database. Marked for review — not created.',
            });
        }
    }
    return {
        headers: ['Requested Product Name', 'Found', 'Product ID', 'Database Product Name', 'Brand', 'Note'],
        rows,
    };
}

// Sheet 8: Import Review — review-only worksheet for products that MAY need to
// be added. Approval status is always PENDING. No product data is invented.
export function buildImportReviewSheet(auditRows) {
    const rows = [];
    for (const r of auditRows) {
        // Candidates for import: missing products, awaiting-approval rows, and
        // possible variants that a human may decide to add separately.
        const importable = ['MISSING_PRODUCT', 'AWAITING_BRAND_APPROVAL', 'POSSIBLE_NAME_MATCH'];
        if (!importable.includes(r.status)) continue;

        const brandApproved = r.matchType === 'Brand exact';
        const proposedMapping = brandApproved
            ? `${r.requestedBrand} (id ${r.brandId})`
            : (r.proposedBrand ? `${r.requestedBrand} → ${r.proposedBrand} (id ${r.brandId})` : r.requestedBrand);

        let duplicateCheck;
        if (r.status === 'POSSIBLE_NAME_MATCH' && r.dbProductName) {
            duplicateCheck = `Possible duplicate of "${r.dbProductName}" (id ${r.productId})`;
        } else {
            duplicateCheck = 'No duplicate found';
        }

        let decision;
        if (r.status === 'MISSING_PRODUCT') {
            decision = 'REVIEW — candidate to add';
        } else if (r.status === 'AWAITING_BRAND_APPROVAL') {
            decision = 'HOLD — confirm brand mapping first';
        } else {
            decision = 'REVIEW — possible variant, do not auto-add';
        }

        rows.push({
            requestedBrand: r.requestedBrand,
            requestedProduct: r.requestedProduct,
            proposedMapping,
            approvalStatus: 'PENDING',
            duplicateCheck,
            decision,
            note: r.notes,
        });
    }
    return {
        headers: ['Requested Brand', 'Requested Product Name', 'Proposed Brand Mapping', 'Approval Status', 'Duplicate Check Status', 'Import Decision', 'Review Notes'],
        rows,
    };
}

// Sheet 9: Summary — counts across all classifications.
export function buildSummarySheet(auditRows, brandAuditRows, nameVariantRows, importReviewRows) {
    const count = (s) => auditRows.filter((r) => r.status === s).length;
    const requestedProducts = auditRows.length;
    const exactMatches = count('EXISTS');
    const possibleVariants = count('POSSIBLE_NAME_MATCH');
    const missingProducts = count('MISSING_PRODUCT');
    const awaitingApproval = count('AWAITING_BRAND_APPROVAL');
    const missingBrands = count('MISSING_BRAND');
    const missingOrUnconfirmedBrands = brandAuditRows.filter((r) => r.exists === 'No').length;
    const potentialDuplicates = nameVariantRows.filter((r) => r.source === 'Duplicate within brand').length;
    const manualReview = auditRows.filter((r) =>
        ['MISSING_BRAND', 'REVIEW_REQUIRED', 'AWAITING_BRAND_APPROVAL'].includes(r.status)
    ).length;

    const rows = [
        { metric: 'Requested products', value: requestedProducts },
        { metric: 'Exact matches (EXISTS)', value: exactMatches },
        { metric: 'Possible name variants (POSSIBLE_NAME_MATCH)', value: possibleVariants },
        { metric: 'Confirmed missing products (MISSING_PRODUCT)', value: missingProducts },
        { metric: 'Products awaiting brand-mapping approval', value: awaitingApproval },
        { metric: 'Missing brands (MISSING_BRAND)', value: missingBrands },
        { metric: 'Requested/canonical brands missing or unconfirmed', value: missingOrUnconfirmedBrands },
        { metric: 'Potential duplicates detected', value: potentialDuplicates },
        { metric: 'Records requiring manual review', value: manualReview },
        { metric: 'Import-review candidates (all pending)', value: importReviewRows.length },
    ];
    return { headers: ['Metric', 'Count'], rows };
}

// ── Excel writer (ExcelJS — already a project dependency) ─────────────────
const STATUS_FILL = {
    EXISTS: 'FFD5F5E3',               // green
    MISSING_PRODUCT: 'FFFADBD8',      // red
    MISSING_BRAND: 'FFFADBD8',        // red
    POSSIBLE_NAME_MATCH: 'FFFDF2E9',  // amber
    AWAITING_BRAND_APPROVAL: 'FFFDF2E9', // amber
    REVIEW_REQUIRED: 'FFFDF2E9',      // amber
    PENDING: 'FFFDF2E9',              // amber (import approval)
};

async function writeWorkbook(sheets, outputPath) {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MS Fragrance catalog audit';
    workbook.created = new Date();

    for (const sheet of sheets) {
        const ws = workbook.addWorksheet(sheet.name, {
            views: [{ state: 'frozen', ySplit: 1 }], // freeze the header row
        });

        ws.columns = sheet.headers.map((header, index) => ({
            header,
            key: `c${index}`,
            width: (sheet.widths && sheet.widths[index]) || Math.max(14, Math.min(46, header.length + 6)),
        }));

        const headerRow = ws.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        headerRow.commit();

        // Columns whose value should drive the row's status coloring.
        const statusColumns = ['Audit Status', 'Approval Status', 'Import Decision', 'Brand Exists'];

        sheet.rows.forEach((row, rowIndex) => {
            const values = sheet.headers.map((_, colIndex) => {
                const key = Object.keys(row)[colIndex];
                return row[key];
            });
            const added = ws.addRow(values);

            // Color any status-like cell based on its value.
            sheet.headers.forEach((header, colIndex) => {
                if (!statusColumns.includes(header)) return;
                const value = values[colIndex];
                const fill = STATUS_FILL[value];
                if (fill) {
                    added.getCell(colIndex + 1).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: fill },
                    };
                }
            });

            // Light banding for readability (skip already-filled status cells).
            if (rowIndex % 2 === 1) {
                added.eachCell((cell, colNumber) => {
                    const header = sheet.headers[colNumber - 1];
                    const isStatus = statusColumns.includes(header);
                    const alreadyFilled = isStatus && cell.fill && cell.fill.pattern === 'solid';
                    if (!alreadyFilled) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F6F7' } };
                    }
                });
            }
        });

        if (sheet.rows.length) {
            ws.autoFilter = {
                from: { row: 1, column: 1 },
                to: { row: sheet.rows.length + 1, column: sheet.headers.length },
            };
        }
    }

    await workbook.xlsx.writeFile(outputPath);
    return outputPath;
}


// ── Database fetch (READ-ONLY) ────────────────────────────────────────────
// Only SELECT statements. Credentials never printed; only a redacted target is
// logged so the operator can confirm WHICH database is being inspected.

function redactDatabaseTarget(url) {
    try {
        const parsed = new URL(url);
        const db = parsed.pathname ? parsed.pathname.replace(/^\//, '') : '';
        return `${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}${db ? '/' + db : ''}`;
    } catch {
        return '(unparseable DATABASE_URL host)';
    }
}

async function fetchBrands(queryFn) {
    const result = await queryFn('SELECT id, name FROM brands ORDER BY name ASC', []);
    return result.rows;
}

async function fetchProducts(queryFn) {
    // brand is a TEXT column on products; select the fields useful for audit.
    const result = await queryFn(
        'SELECT id, name, brand, price, in_stock, created_at FROM products ORDER BY id ASC',
        []
    );
    return result.rows;
}

function groupProductsByBrand(products) {
    const map = new Map();
    for (const p of products) {
        const key = normalize(p.brand);
        if (!key) continue; // products with no brand text can't be brand-matched
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(p);
    }
    return map;
}

function timestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

// Build a never-overwriting output path under <backend>/reports/.
function resolveOutputPath() {
    const reportsDir = path.join(__dirname, 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    return path.join(reportsDir, `catalog-audit-${timestamp()}.xlsx`);
}

// ── Orchestration ─────────────────────────────────────────────────────────
async function main() {
    const queryFn = query; // read-only SELECTs via the shared pool

    console.log('[catalog-audit] environment =', config.environment);
    console.log('[catalog-audit] database    =', redactDatabaseTarget(config.database.url));
    console.log('[catalog-audit] mode        = READ-ONLY (no inserts/updates/deletes)');

    let brands;
    let products;
    try {
        brands = await fetchBrands(queryFn);
        products = await fetchProducts(queryFn);
    } catch (error) {
        console.error('[catalog-audit] database error:', error.message);
        await closeDb().catch(() => {});
        process.exitCode = 1;
        return;
    }

    const productsByBrand = groupProductsByBrand(products);
    console.log(`[catalog-audit] fetched ${brands.length} brands, ${products.length} products`);

    // Build all sheet data (pure logic).
    const auditRows = buildCatalogAuditRows(REQUESTED_CATALOG, brands, productsByBrand);
    const missing = buildMissingProductsSheet(auditRows);
    const existing = buildExistingProductsSheet(auditRows);
    const brandAudit = buildBrandAuditSheet(REQUESTED_CATALOG, brands);
    const nameVariants = buildNameVariantsSheet(auditRows, brands, productsByBrand);
    const jannatul = buildJannatulSheet(JANNATUL_FIRDOUS, brands, productsByBrand);
    const additional = buildAdditionalProductsSheet(ADDITIONAL_PRODUCTS, brands, productsByBrand);
    const importReview = buildImportReviewSheet(auditRows);
    const summary = buildSummarySheet(auditRows, brandAudit.rows, nameVariants.rows, importReview.rows);

    const catalogSheet = {
        name: 'Catalog Audit',
        headers: ['Requested Brand', 'Requested Product Name', 'Proposed Existing Brand', 'Brand ID', 'Database Brand Name', 'Database Product Name', 'Product ID', 'Match Type', 'Audit Status', 'Review Notes'],
        rows: auditRows,
        widths: [22, 24, 22, 10, 22, 24, 10, 22, 24, 60],
    };

    const sheets = [
        catalogSheet,
        { name: 'Missing Products', ...missing },
        { name: 'Existing Products', ...existing },
        { name: 'Brand Audit', ...brandAudit, widths: [24, 12, 14, 10, 24, 40, 52] },
        { name: 'Name Variants', ...nameVariants, widths: [26, 26, 14, 22, 24, 52] },
        { name: 'Jannatul Firdous', ...jannatul },
        { name: 'Additional Products', ...additional },
        { name: 'Import Review', ...importReview, widths: [22, 24, 34, 16, 40, 30, 60] },
        { name: 'Summary', ...summary },
    ];

    const outputPath = resolveOutputPath();
    try {
        await writeWorkbook(sheets, outputPath);
    } catch (error) {
        if (error && (error.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find package/.test(error.message))) {
            console.error('[catalog-audit] ExcelJS is not installed. Run: npm install exceljs');
        } else {
            console.error('[catalog-audit] failed to write workbook:', error.message);
        }
        await closeDb().catch(() => {});
        process.exitCode = 1;
        return;
    }

    console.log(`[catalog-audit] workbook written to: ${outputPath}`);
    await closeDb().catch(() => {});
}

// Only run when executed directly (not when imported by tests).
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (invokedDirectly) {
    main().catch((error) => {
        console.error('[catalog-audit] unexpected error:', error.message);
        process.exitCode = 1;
    });
}

