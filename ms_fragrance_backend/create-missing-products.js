#!/usr/bin/env node
/**
 * create-missing-products.js — Resumable, idempotent creation of the 47
 * operator-approved catalog products in the MS Fragrance Postgres database.
 *
 * - Reuses the real application services (CreateProductUseCase, aiFill,
 *   AiGenerateProductImage, UploadProductImageUseCase) so all validation,
 *   image handling and required DB fields are respected. No ad hoc inserts.
 * - Re-queries the live database immediately before every creation and never
 *   creates a duplicate (exact or near-name variant under the canonical brand).
 * - Generates descriptions via the existing aiFill service and images via the
 *   existing gpt-image-2 integration + master reference bottle image; images
 *   are validated (PNG bytes), uploaded to Supabase storage and verified by
 *   URL before the product row is written. Raw base64 is never stored.
 * - Pricing is the operator-approved Option A ladder (uniform 799/979/1299,
 *   original 949 = +150) matching the exact tier rule documented in seed.js
 *   (6ml = price + 180, 12ml = price + 500) and every existing DB product.
 * - Statuses per product: CREATED | ALREADY_EXISTS |
 *   SKIPPED_MISSING_REQUIRED_DATA | IMAGE_FAILED | FAILED.
 *
 * Usage:
 *   node create-missing-products.js                 # process up to 5 pending
 *   node create-missing-products.js --max-items=10  # batch size override
 *   node create-missing-products.js --update-workbook  # refresh workbook only
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

import { createProductsContainer } from './src/modules/products/products.container.js';
import { FRAGRANCE_FAMILIES } from './src/modules/products/product.constants.js';
import {
    query,
    closeDb,
} from './src/infrastructure/database/postgres-database.js';
import { config } from './src/config/env.js';
import {
    REQUESTED_CATALOG,
    normalize,
    looseNormalize,
} from './audit-catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.join(__dirname, 'reports');
const STATE_PATH = path.join(REPORTS_DIR, 'create-products-state.json');
const WORKBOOK_PATH = path.join(
    REPORTS_DIR,
    'catalog-audit-20261014-063529-approved-mappings.xlsx'
);
const WORKBOOK_BACKUP_PATH = path.join(
    REPORTS_DIR,
    'catalog-audit-20261014-063529-approved-mappings.pre-execution.bak.xlsx'
);

// ── Operator-approved constants (Option A, approved in this task) ──────────
const APPROVED_PRICING = Object.freeze({
    price: 799,
    originalPrice: 949, // seed.js + every existing DB product: price + 150
    sizePricing: Object.freeze({ '3ml': 799, '6ml': 979, '12ml': 1299 }),
    sizes: Object.freeze(['3ml', '6ml', '12ml']),
});

// Requested brand -> existing canonical brand (operator-approved mappings).
const APPROVED_MAPPINGS = Object.freeze({
    'Inspired Fragrances': 'Inspire Fragrances',
    'SMD Ayyub Yakub': 'SMD Ayyub MD Yaqub',
});

const STATUS = Object.freeze({
    CREATED: 'CREATED',
    ALREADY_EXISTS: 'ALREADY_EXISTS',
    SKIPPED: 'SKIPPED_MISSING_REQUIRED_DATA',
    IMAGE_FAILED: 'IMAGE_FAILED',
    FAILED: 'FAILED',
});

// Environmental failure: the OpenAI organization has no credits (429).
// This aborts the whole run immediately — it must never consume a product's
// run attempt or mark the product FAILED, because the item itself is fine.
class OutOfCreditsError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OutOfCreditsError';
    }
}

function isOutOfCreditsError(error) {
    const message = String(error?.message || '');
    return (
        error?.status === 429 ||
        /no credits remaining|insufficient_quota/i.test(message)
    );
}

function asOutOfCredits(error) {
    return error instanceof OutOfCreditsError
        ? error
        : new OutOfCreditsError(String(error?.message || error));
}

// Cap reruns per item so a permanently broken item cannot loop forever.
const MAX_RUN_ATTEMPTS = 3;

function canonicalBrandFor(requestedBrand) {
    return APPROVED_MAPPINGS[requestedBrand] || requestedBrand;
}

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

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(...parts) {
    console.log(`[create-products] ${parts.join(' ')}`);
}

function loadState() {
    try {
        const raw = fs.readFileSync(STATE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.results) return parsed;
    } catch {
        // Missing or unreadable state starts a fresh state file.
    }
    return { updatedAt: null, results: {} };
}

function saveState(state) {
    state.updatedAt = new Date().toISOString();
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const tmpPath = `${STATE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2));
    fs.renameSync(tmpPath, STATE_PATH); // atomic replace
}

function parseArgs(argv) {
    const args = { maxItems: 5, updateWorkbook: false };
    for (const arg of argv) {
        if (arg === '--update-workbook') args.updateWorkbook = true;
        else if (arg.startsWith('--max-items=')) {
            const value = Number(arg.split('=')[1]);
            if (Number.isInteger(value) && value > 0) args.maxItems = value;
        }
    }
    return args;
}

function buildRequestedItems() {
    const items = [];
    for (const group of REQUESTED_CATALOG) {
        for (const name of group.products) {
            items.push({
                requestedBrand: group.brand,
                canonicalBrand: canonicalBrandFor(group.brand),
                name,
            });
        }
    }
    return items;
}

// ── Validation helpers ────────────────────────────────────────────────────

// Validate a base64-encoded PNG: signature, IEND footer, sane size.
function validatePngBase64(b64) {
    if (!b64 || typeof b64 !== 'string') {
        throw new Error('missing base64 image data');
    }
    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length < 10240) {
        throw new Error(`decoded image too small (${buffer.length} bytes)`);
    }
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < signature.length; i += 1) {
        if (buffer[i] !== signature[i]) {
            throw new Error('decoded image is not a PNG (bad signature)');
        }
    }
    const footer = buffer.subarray(buffer.length - 8, buffer.length - 4);
    if (footer.toString('latin1') !== 'IEND') {
        throw new Error('decoded PNG is truncated (no IEND chunk)');
    }
    return buffer;
}

// Verify the uploaded image is publicly reachable with real image bytes.
async function verifyImageUrl(url) {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) {
        throw new Error(`image URL HEAD returned ${response.status}`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
        throw new Error(`image URL content-type is "${contentType}"`);
    }
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength < 10240) {
        throw new Error(`image URL content-length is ${contentLength}`);
    }
}

// aiFill returns note fields as comma-separated strings; the product
// validator requires arrays (mirrors the admin form's csvToArray step).
function csvToNotesArray(value) {
    return String(value || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
}

// Prefer a fragrance family from the app's FRAGRANCE_FAMILIES domain
// (case-insensitive), else fall back to the AI free-text value, exactly as
// the admin product form (free-text fragrance family) would allow.
function pickFragranceType(aiData) {
    const candidates = [aiData.fragranceFamily, aiData.fragranceType]
        .map((value) => String(value || '').trim())
        .filter(Boolean);
    for (const candidate of candidates) {
        const match = FRAGRANCE_FAMILIES.find(
            (family) => family.toLowerCase() === candidate.toLowerCase()
        );
        if (match) return match;
    }
    return candidates[0] || '';
}

// Live duplicate check immediately before creation: exact normalized name
// under the canonical brand, or any near-name variant under that brand.
async function checkExisting(canonicalBrand, name) {
    const result = await query(
        'SELECT id, name, brand FROM products ORDER BY id ASC',
        []
    );
    const brandKey = normalize(canonicalBrand);
    const brandProducts = result.rows.filter(
        (row) => normalize(row.brand) === brandKey
    );
    const exact = brandProducts.find((row) => normalize(row.name) === normalize(name));
    if (exact) return { kind: 'exact', row: exact };

    const target = looseNormalize(name);
    // Block only spacing/punctuation variants (loose-normalized equality).
    // Fuzzy edit-distance matches are NOT treated as duplicates: distinct
    // products like "Mukhallat Rayyan" vs "Mukhallat Ayyub" must both exist.
    const variant = brandProducts.find(
        (row) =>
            looseNormalize(row.name) === target &&
            normalize(row.name) !== normalize(name)
    );
    if (variant) return { kind: 'variant', row: variant };
    return null;
}

async function retry(fn, attempts, delayMs) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await fn();
        } catch (error) {
            // Out-of-credits never benefits from retrying: abort immediately.
            if (isOutOfCreditsError(error)) throw asOutOfCredits(error);
            lastError = error;
            if (attempt < attempts) await sleep(delayMs);
        }
    }
    throw lastError;
}

// ── Per-product pipeline ──────────────────────────────────────────────────

async function generateDescription(aiFillUseCase, name) {
    let lastData = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
        const data = await retry(() => aiFillUseCase.execute({ name }), 2, 5000);
        lastData = data;
        const description = String(data?.description || '').trim();
        const fullDescription = String(data?.fullDescription || '').trim();
        if (description && fullDescription) {
            return { data, description, fullDescription };
        }
        await sleep(5000);
    }
    const error = new Error('aiFill returned an empty description');
    error.aiData = lastData;
    throw error;
}

async function generateAndUploadImage(aiImageUseCase, uploadUseCase, promptData) {
    // Generation + byte validation share the retry loop so a truncated or
    // malformed API payload is retried instead of failing the product.
    const buffer = await retry(async () => {
        const base64 = await aiImageUseCase.execute(promptData);
        return validatePngBase64(base64);
    }, 2, 8000);
    const uploaded = await retry(
        () =>
            uploadUseCase.execute(
                {
                    buffer,
                    mimetype: 'image/png',
                    originalname: 'ai-product.png',
                },
                undefined // admin flow uploads pre-create under products/product-new/
            ),
        2,
        5000
    );
    if (!uploaded?.url || !uploaded?.path) {
        throw new Error('storage upload returned no url/path');
    }
    await retry(() => verifyImageUrl(uploaded.url), 2, 5000);
    return uploaded;
}

async function verifyCreatedRow(productId, name, canonicalBrand, imageUrl) {
    const result = await query(
        `SELECT id, name, brand, price, original_price, size_pricing, sizes,
                stock_quantity, image_url, image_urls, category
         FROM products WHERE id = $1`,
        [productId]
    );
    const row = result.rows[0];
    if (!row) throw new Error(`created row id=${productId} not found after insert`);
    const problems = [];
    if (normalize(row.name) !== normalize(name)) problems.push(`name "${row.name}"`);
    if (normalize(row.brand) !== normalize(canonicalBrand)) problems.push(`brand "${row.brand}"`);
    if (Number(row.price) !== APPROVED_PRICING.price) problems.push(`price ${row.price}`);
    if (row.image_url !== imageUrl) problems.push('image_url mismatch');
    if (Number(row.stock_quantity) !== 1) problems.push(`stock ${row.stock_quantity}`);
    if (problems.length > 0) {
        throw new Error(`post-create verification failed: ${problems.join(', ')}`);
    }
    await verifyImageUrl(row.image_url);
    return row;
}

async function processItem(item, context) {
    const { requestedBrand, canonicalBrand, name } = item;
    const stateKey = `${canonicalBrand}|${name}`;
    const record = context.state.results[stateKey] || {
        status: null,
        runAttempts: 0,
    };
    record.requestedBrand = requestedBrand;
    record.name = name;
    record.canonicalBrand = canonicalBrand;

    // Fresh duplicate check immediately before any work that could create.
    const existing = await checkExisting(canonicalBrand, name);
    if (existing) {
        record.status = STATUS.ALREADY_EXISTS;
        record.productId = Number(existing.row.id);
        record.imageUrl = null;
        record.imagePath = null;
        record.notes =
            existing.kind === 'exact'
                ? 'Exact normalized name already present under canonical brand.'
                : `Near-name variant already present under canonical brand: "${existing.row.name}" (id=${existing.row.id}) - not created to avoid a duplicate.`;
        record.updatedAt = new Date().toISOString();
        context.state.results[stateKey] = record;
        log(`ALREADY_EXISTS ${canonicalBrand} / ${name} -> id=${record.productId}`);
        return record;
    }

    // 1) Description via the existing aiFill service. A previously generated
    // result is cached in state so resumable reruns never re-spend the text
    // API on content we already hold.
    let aiData;
    let description;
    let fullDescription;
    const cached = record.aiCache;
    if (
        cached &&
        String(cached.description || '').trim() &&
        String(cached.fullDescription || '').trim()
    ) {
        aiData = cached;
        description = String(cached.description).trim();
        fullDescription = String(cached.fullDescription).trim();
        log(`(description cache hit) ${canonicalBrand} / ${name}`);
    } else {
        try {
            ({ data: aiData, description, fullDescription } = await generateDescription(
                context.aiFillUseCase,
                name
            ));
            record.aiCache = aiData;
        } catch (error) {
            if (error instanceof OutOfCreditsError) throw error;
            record.status = STATUS.FAILED;
            record.notes = `Description generation failed after retries: ${error.message}`;
            record.updatedAt = new Date().toISOString();
            context.state.results[stateKey] = record;
            log(`FAILED (description) ${canonicalBrand} / ${name}: ${error.message}`);
            return record;
        }
    }

    const fragranceType =
        (context.fragranceOverrides[stateKey] || '').trim() ||
        pickFragranceType(aiData);
    if (!fragranceType) {
        record.status = STATUS.SKIPPED;
        record.notes =
            'Fragrance family unavailable from aiFill (required non-empty by product validator); not created. Operator can supply a family via reports/fragrance-overrides.json.';
        record.updatedAt = new Date().toISOString();
        context.state.results[stateKey] = record;
        log(`SKIPPED ${canonicalBrand} / ${name}: no fragrance family`);
        return record;
    }

    // 2) Image via gpt-image-2 + master reference; validate, upload, verify.
    let uploaded;
    try {
        uploaded = await generateAndUploadImage(
            context.aiGenerateProductImageUseCase,
            context.uploadProductImageUseCase,
            {
                name,
                description,
                fragranceFamily: fragranceType,
                topNotes: String(aiData.topNotes || ''),
                heartNotes: String(aiData.heartNotes || ''),
                baseNotes: String(aiData.baseNotes || ''),
            }
        );
    } catch (error) {
        if (error instanceof OutOfCreditsError) throw error;
        record.status = STATUS.IMAGE_FAILED;
        record.notes = `Image generation/upload failed after retries: ${error.message}`;
        record.updatedAt = new Date().toISOString();
        context.state.results[stateKey] = record;
        log(`IMAGE_FAILED ${canonicalBrand} / ${name}: ${error.message}`);
        return record;
    }

    // 3) Create through the real application use case (validated + normalized).
    let created;
    try {
        created = await context.createProductUseCase.execute({
            name,
            brand: canonicalBrand,
            category: 'Attar',
            fragranceType,
            description,
            fullDescription,
            price: APPROVED_PRICING.price,
            originalPrice: APPROVED_PRICING.originalPrice,
            sizePricing: { ...APPROVED_PRICING.sizePricing },
            topNotes: csvToNotesArray(aiData.topNotes),
            heartNotes: csvToNotesArray(aiData.heartNotes),
            baseNotes: csvToNotesArray(aiData.baseNotes),
            imageUrl: uploaded.url,
            imageUrls: [uploaded.url],
        });
    } catch (error) {
        record.status = STATUS.FAILED;
        record.notes = `CreateProductUseCase failed: ${error.message}`;
        record.updatedAt = new Date().toISOString();
        context.state.results[stateKey] = record;
        log(`FAILED (create) ${canonicalBrand} / ${name}: ${error.message}`);
        return record;
    }

    // 4) Verify the persisted row and the live image URL.
    try {
        await verifyCreatedRow(created.id, name, canonicalBrand, uploaded.url);
    } catch (error) {
        record.status = STATUS.FAILED;
        record.productId = created.id;
        record.notes = `Row created (id=${created.id}) but verification failed: ${error.message} - manual review required; NOT deleted.`;
        record.updatedAt = new Date().toISOString();
        context.state.results[stateKey] = record;
        log(`FAILED (verify) ${canonicalBrand} / ${name}: ${error.message}`);
        return record;
    }

    record.status = STATUS.CREATED;
    record.productId = created.id;
    record.imageUrl = uploaded.url;
    record.imagePath = uploaded.path;
    record.fragranceType = fragranceType;
    record.notes = 'Created and verified (row + live image URL).';
    record.updatedAt = new Date().toISOString();
    context.state.results[stateKey] = record;
    log(`CREATED ${canonicalBrand} / ${name} -> id=${created.id}`);
    return record;
}

// Operator-supplied fragrance-family overrides for products the aiFill
// service cannot classify (reports/fragrance-overrides.json, optional):
// { "Inspire Fragrances|Marj": "Oud", ... }. Explicit operator input takes
// precedence over the model; nothing is ever guessed here.
function loadFragranceOverrides() {
    const overridePath = path.join(REPORTS_DIR, 'fragrance-overrides.json');
    try {
        const parsed = JSON.parse(fs.readFileSync(overridePath, 'utf8'));
        if (parsed && typeof parsed === 'object') return parsed;
    } catch {
        // Optional file; absence means no overrides.
    }
    return {};
}

// ── Orchestration ─────────────────────────────────────────────────────────

// CREATED and ALREADY_EXISTS are terminal; other failures are retried on
// later runs until MAX_RUN_ATTEMPTS is reached (resumable, never duplicated).
// SKIPPED items wait on operator input rather than failing, so they stay
// pending forever — re-checking them is free once the aiCache is warm.
function isPending(record) {
    if (!record || !record.status) return true;
    if (record.status === STATUS.CREATED || record.status === STATUS.ALREADY_EXISTS) {
        return false;
    }
    if (record.status === STATUS.SKIPPED) return true;
    return (record.runAttempts || 0) < MAX_RUN_ATTEMPTS;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const state = loadState();

    log('environment     :', config.environment);
    log('database target :', redactDatabaseTarget(config.database.url));
    log('storage bucket  :', config.storage.bucket);
    log(
        'mode            :',
        args.updateWorkbook
            ? 'UPDATE WORKBOOK ONLY (no product writes)'
            : `PROCESS (max ${args.maxItems} items)`
    );

    if (args.updateWorkbook) {
        await updateWorkbook(state);
        await closeDb();
        return;
    }

    const container = createProductsContainer();
    const context = {
        state,
        fragranceOverrides: loadFragranceOverrides(),
        createProductUseCase: container.createProductUseCase,
        aiFillUseCase: container.aiFillProductUseCase,
        aiGenerateProductImageUseCase: container.aiGenerateProductImageUseCase,
        uploadProductImageUseCase: container.uploadProductImageUseCase,
    };

    const items = buildRequestedItems();
    const pending = items.filter((item) =>
        isPending(state.results[`${item.canonicalBrand}|${item.name}`])
    );
    log(`items: ${items.length} total | pending: ${pending.length}`);

    const batch = pending.slice(0, args.maxItems);
    let processed = 0;
    for (const item of batch) {
        const key = `${item.canonicalBrand}|${item.name}`;
        const previous = state.results[key];
        state.results[key] = {
            ...(previous || {}),
            runAttempts: ((previous && previous.runAttempts) || 0) + 1,
        };
        let result;
        try {
            result = await processItem(item, context);
        } catch (error) {
            if (!(error instanceof OutOfCreditsError)) throw error;
            // Environmental abort: give this item its attempt back, keep any
            // freshly cached description, and stop the run immediately so no
            // further item is touched while the API is unusable.
            const current = state.results[key];
            if (current) {
                current.runAttempts = (previous && previous.runAttempts) || 0;
                if (!current.status && !current.aiCache) delete state.results[key];
            }
            saveState(state);
            log(
                `FATAL: OpenAI has no credits remaining - run aborted at "${key}".`,
                'No run attempt consumed; top up credits and rerun.'
            );
            process.exitCode = 1;
            break;
        }
        saveState(state);
        processed += 1;
        log(
            `[${processed}/${batch.length}] ${result.status}: ${item.canonicalBrand} / ${item.name}`
        );
    }

    const counts = {};
    for (const record of Object.values(state.results)) {
        counts[record.status] = (counts[record.status] || 0) + 1;
    }
    log('run summary:', JSON.stringify(counts));
    log('state saved :', STATE_PATH);
    await closeDb();
}

// ── Workbook update (writes actual results back into the approved audit) ──

async function updateWorkbook(state) {
    if (!fs.existsSync(WORKBOOK_PATH)) {
        throw new Error(`workbook not found: ${WORKBOOK_PATH}`);
    }
    if (!fs.existsSync(WORKBOOK_BACKUP_PATH)) {
        fs.copyFileSync(WORKBOOK_PATH, WORKBOOK_BACKUP_PATH);
        log('backup written:', WORKBOOK_BACKUP_PATH);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(WORKBOOK_PATH);
    const nowIso = new Date().toISOString();

    // Re-verify every CREATED record against the live DB + live image URL.
    const dbCheck = new Map();
    for (const [key, record] of Object.entries(state.results)) {
        if (record.status !== STATUS.CREATED || !record.productId) continue;
        const result = await query(
            'SELECT id, image_url FROM products WHERE id = $1',
            [record.productId]
        );
        const row = result.rows[0];
        let imageOk = false;
        if (row?.image_url) {
            try {
                await verifyImageUrl(row.image_url);
                imageOk = true;
            } catch {
                imageOk = false;
            }
        }
        dbCheck.set(key, { present: Boolean(row), imageOk });
    }

    // Must produce the exact same brand text used in the state keys
    // (canonical brand casing), only resolving approved mapping aliases.
    const canonicalKey = (brandText) => {
        const brand = String(brandText || '').trim();
        return APPROVED_MAPPINGS[brand] || brand;
    };
    const lookupRecord = (brandCell, nameCell) => {
        const name = String(nameCell || '').trim();
        const direct = state.results[`${canonicalKey(brandCell)}|${name}`];
        if (direct) return direct;
        // Fallback: case-insensitive brand/name match against state keys.
        const target = `${canonicalKey(brandCell)}|${name}`.toLowerCase();
        const entry = Object.entries(state.results).find(
            ([key]) => key.toLowerCase() === target
        );
        return entry ? entry[1] : null;
    };
    const rowKey = (brandCell, nameCell) => {
        const record = lookupRecord(brandCell, nameCell);
        const name = String(nameCell || '').trim();
        return record
            ? `${record.canonicalBrand || canonicalKey(brandCell)}|${name}`
            : `${canonicalKey(brandCell)}|${name}`;
    };
    const checkText = (key) => {
        const check = dbCheck.get(key);
        if (!check) return '';
        if (!check.present) return ' [ROW MISSING FROM DB]';
        return check.imageOk ? ' [DB row + image verified]' : ' [DB row verified; IMAGE NOT REACHABLE]';
    };

    const catalogSheet = workbook.getWorksheet('Catalog Audit');
    if (catalogSheet) {
        catalogSheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const key = rowKey(row.getCell(1).value, row.getCell(2).value);
            const record = state.results[key];
            if (!record) return;
            if (record.productId) row.getCell(7).value = record.productId;
            row.getCell(9).value = record.status;
            row.getCell(10).value =
                `EXECUTED ${record.updatedAt || nowIso}: ${record.status}` +
                (record.productId ? ` id=${record.productId}` : '') +
                (record.imageUrl ? ` image=${record.imageUrl}` : '') +
                checkText(key) +
                (record.notes ? ` - ${record.notes}` : '');
        });
    }

    const importSheet = workbook.getWorksheet('Import Review');
    if (importSheet) {
        const headers = [
            'Execution Result',
            'Product ID',
            'Image URL',
            'Image Storage Path',
            'Executed At (UTC)',
            'Execution Notes',
        ];
        const headerRow = importSheet.getRow(1);
        headers.forEach((header, index) => {
            headerRow.getCell(8 + index).value = header;
        });
        importSheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const key = rowKey(row.getCell(1).value, row.getCell(2).value);
            const record = state.results[key];
            if (!record) return;
            row.getCell(6).value = record.status; // Import Decision
            row.getCell(8).value = record.status;
            row.getCell(9).value = record.productId || '';
            row.getCell(10).value = record.imageUrl || '';
            row.getCell(11).value = record.imagePath || '';
            row.getCell(12).value = record.updatedAt || nowIso;
            row.getCell(13).value =
                checkText(key).replace(/^\s+|\s+$/g, '') +
                (record.notes ? `${checkText(key) ? ' - ' : ''}${record.notes}` : '');
        });
    }

    const summarySheet = workbook.getWorksheet('Summary');
    if (summarySheet) {
        const counts = {
            CREATED: 0,
            ALREADY_EXISTS: 0,
            SKIPPED_MISSING_REQUIRED_DATA: 0,
            IMAGE_FAILED: 0,
            FAILED: 0,
        };
        let notProcessed = 0;
        for (const item of buildRequestedItems()) {
            const record = state.results[`${item.canonicalBrand}|${item.name}`];
            if (record && record.status) {
                counts[record.status] = (counts[record.status] || 0) + 1;
            } else {
                notProcessed += 1;
            }
        }
        // Idempotent: reuse rows from a previous workbook update if present.
        let nextRow = summarySheet.rowCount + 1;
        for (let r = 1; r <= summarySheet.rowCount; r += 1) {
            if (summarySheet.getRow(r).getCell(1).value === 'Execution timestamp (UTC)') {
                nextRow = r;
                break;
            }
        }
        const addSummaryRow = (metric, value) => {
            const row = summarySheet.getRow(nextRow);
            row.getCell(1).value = metric;
            row.getCell(2).value = value;
            nextRow += 1;
        };
        addSummaryRow('Execution timestamp (UTC)', nowIso);
        addSummaryRow('Products CREATED (verified)', counts.CREATED);
        addSummaryRow('Products ALREADY_EXISTS', counts.ALREADY_EXISTS);
        addSummaryRow('Products SKIPPED_MISSING_REQUIRED_DATA', counts.SKIPPED_MISSING_REQUIRED_DATA);
        addSummaryRow('Products IMAGE_FAILED', counts.IMAGE_FAILED);
        addSummaryRow('Products FAILED', counts.FAILED);
        addSummaryRow('Products not yet processed', notProcessed);
    }

    const tmpPath = `${WORKBOOK_PATH}.tmp`;
    await workbook.xlsx.writeFile(tmpPath);
    fs.renameSync(tmpPath, WORKBOOK_PATH);
    log('workbook updated:', WORKBOOK_PATH);
}

main().catch(async (error) => {
    console.error('[create-products] FATAL:', error.message);
    await closeDb().catch(() => {});
    process.exitCode = 1;
});






