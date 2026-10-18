#!/usr/bin/env node
/**
 * optimize-product-images.js
 * ---------------------------------------------------------------------------
 * Batch-optimizes MS Fragrance product images stored in Supabase Storage.
 *
 * - Walks every product row (paginated, keyset) and collects the primary image
 *   (`products.image_url`) plus every gallery image (`products.image_urls`
 *   JSONB array; ordering and structure preserved).
 * - Re-encodes each image to WebP (quality 82-85, default 85; full chroma kept
 *   via smartSubsample:false to protect bottle-label detail; transparency
 *   preserved; EXIF auto-oriented) and resizes anything larger than
 *   1200x1200 to fit inside that box WITHOUT upscaling.
 * - Uploads the WebP as a NEW file next to the original (`<stem>-opt.webp`).
 *   Originals are NEVER modified or deleted.
 * - Verifies the uploaded file is publicly reachable (HEAD, retried) and only
 *   then updates the database URL with a guard so concurrent edits are never
 *   overwritten.
 *
 * Safety
 *   - DRY RUN IS THE DEFAULT: no uploads, no DB writes, no files written.
 *   - Idempotent: `-opt.webp` URLs are skipped; existing `-opt.webp` uploads
 *     are reused instead of duplicated.
 *   - Per-image error isolation, controlled concurrency, product pagination.
 *   - Every applied change is journalled to `logs/image-opt-journal-*.jsonl`,
 *     which doubles as the rollback artifact (`--rollback <journal>` restores
 *     previous URLs; it never deletes optimized files either).
 *   - The Supabase service-role key is read from the environment only and is
 *     never printed.
 *
 * Usage
 *   node optimize-product-images.js                 # dry run (read-only)
 *   node optimize-product-images.js --apply         # perform migration
 *   node optimize-product-images.js --rollback logs/image-opt-journal-<ts>.jsonl
 * ---------------------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './src/config/env.js';
import { query, withTransaction, closeDb } from './src/db.js';
import {
    bucket,
    getSupabase,
    uploadProductImage,
    getStoragePath,
} from './src/infrastructure/storage/supabase-storage.adapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep in sync with UploadProductImageUseCase's allowed upload types.
const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const OPTIMIZED_MARKER = '-opt';
const OPTIMIZED_SUFFIX = `${OPTIMIZED_MARKER}.webp`;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function clamp(value, min, max, fallback) {
    if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
    return Math.min(max, Math.max(min, value));
}

function printHelp() {
    console.log(`
Optimize MS Fragrance product images in Supabase Storage (WebP, max 1200x1200).

Modes
  (default)          Dry run: download + transcode in memory, report planned
                     changes and estimated savings. No uploads, no DB writes.
  --apply            Perform uploads and guarded database URL updates.
  --rollback <file>  Restore previous image URLs from a journal file written by
                     an --apply run. Never deletes optimized files.

Options
  --quality <82-85>    WebP quality (default 85)
  --max-size <px>      Max width/height, no upscaling (default 1200)
  --concurrency <1-8>  Parallel image workers (default 3)
  --page-size <n>      Products fetched per DB page (default 40)
  --limit <n>          Stop after N unique images (0 = all)
  --product-id <n>     Only process one product
  --delay-ms <n>       Delay between worker tasks (default 250)
  -h, --help           Show this help

Originals are never deleted. Re-running is safe: already-optimized images and
already-uploaded -opt.webp files are skipped/reused.
`);
}

function parseArgs(argv) {
    const options = {
        apply: false,
        rollback: null,
        quality: 85,
        maxSize: 1200,
        concurrency: 3,
        pageSize: 40,
        limit: 0, // 0 = unlimited (unique images)
        productId: null,
        delayMs: 250,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        switch (arg) {
            case '--apply':
                options.apply = true;
                break;
            case '--dry-run':
                options.apply = false;
                break;
            case '--rollback':
                options.rollback = argv[++i] || null;
                if (!options.rollback) throw new Error('--rollback requires a journal file path');
                break;
            case '--quality':
                options.quality = Number(argv[++i]);
                break;
            case '--max-size':
                options.maxSize = Number(argv[++i]);
                break;
            case '--concurrency':
                options.concurrency = Number(argv[++i]);
                break;
            case '--page-size':
                options.pageSize = Number(argv[++i]);
                break;
            case '--limit':
                options.limit = Number(argv[++i]);
                break;
            case '--product-id':
                options.productId = Number(argv[++i]);
                break;
            case '--delay-ms':
                options.delayMs = Number(argv[++i]);
                break;
            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
                break;
            default:
                throw new Error(`Unknown argument: ${arg} (see --help)`);
        }
    }

    // Requirements pin WebP quality to the 82-85 band and the box to 1200x1200.
    options.quality = clamp(options.quality, 82, 85, 85);
    options.maxSize = clamp(options.maxSize, 200, 4096, 1200);
    options.concurrency = clamp(options.concurrency, 1, 8, 3);
    options.pageSize = clamp(options.pageSize, 1, 500, 40);
    options.delayMs = clamp(options.delayMs, 0, 10_000, 250);
    if (Number.isNaN(options.limit) || options.limit < 0) options.limit = 0;
    if (options.productId !== null && Number.isNaN(options.productId)) {
        throw new Error('--product-id must be a number');
    }
    return options;
}

// ---------------------------------------------------------------------------
// Logging helpers (never log credentials; defensively strip URL userinfo)
// ---------------------------------------------------------------------------

const startedAtIso = new Date().toISOString().replace(/[:.]/g, '-');

function ts() {
    return new Date().toISOString();
}

function log(...args) {
    console.log(`[${ts()}]`, ...args);
}

function logWarn(...args) {
    console.warn(`[${ts()}] WARN`, ...args);
}

function logError(...args) {
    console.error(`[${ts()}] ERROR`, ...args);
}

function safeUrl(url) {
    if (typeof url !== 'string') return url;
    try {
        const parsed = new URL(url);
        parsed.username = '';
        parsed.password = '';
        return parsed.toString();
    } catch {
        return url;
    }
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function percentSaved(originalBytes, optimizedBytes) {
    if (!originalBytes) return 0;
    return ((originalBytes - optimizedBytes) / originalBytes) * 100;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry transient Supabase/network failures (429/5xx/network). Downloads and
// list calls are idempotent; uploads are duplicate-safe (see uploadOptimized).
async function withRetry(fn, label, attempts = 3, baseDelayMs = 1500) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < attempts) {
                const delay = baseDelayMs * 2 ** (attempt - 1);
                logWarn(`${label}: attempt ${attempt} failed (${error.message}); retrying in ${delay}ms`);
                await sleep(delay);
            }
        }
    }
    throw lastError;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function publicUrlFor(objectPath) {
    return getSupabase().storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
}

async function findStorageObject(objectPath) {
    const slash = objectPath.lastIndexOf('/');
    const dir = slash === -1 ? '' : objectPath.slice(0, slash);
    const name = slash === -1 ? objectPath : objectPath.slice(slash + 1);
    const { data, error } = await withRetry(
        () => getSupabase().storage.from(bucket).list(dir, { search: name, limit: 100 }),
        `list ${dir || '/'}`
    );
    if (error) throw new Error(`Storage list failed: ${error.message}`);
    return (data || []).find((entry) => entry.name === name) || null;
}

async function downloadObject(objectPath) {
    const { data, error } = await withRetry(
        () => getSupabase().storage.from(bucket).download(objectPath),
        `download ${objectPath}`
    );
    if (error) throw new Error(`Storage download failed: ${error.message}`);
    return Buffer.from(await data.arrayBuffer());
}

async function uploadOptimized(buffer, objectPath) {
    try {
        const uploaded = await withRetry(
            () => uploadProductImage({ buffer, mimetype: 'image/webp' }, objectPath),
            `upload ${objectPath}`,
            3,
            2000
        );
        return { path: uploaded.path, url: uploaded.url, alreadyExisted: false };
    } catch (error) {
        // upsert:false -> an existing file surfaces as a "Duplicate" error.
        // Treat that as success so reruns never duplicate or fail the batch.
        const message = String(error.message || '');
        if (/duplicate|already exists/i.test(message)) {
            return { path: objectPath, url: publicUrlFor(objectPath), alreadyExisted: true };
        }
        throw error;
    }
}

async function verifyOptimizedImage(url) {
    let lastStatus = 'no response';
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            const response = await fetch(safeUrl(url), { method: 'HEAD' });
            if (response.ok) {
                const contentType = (response.headers.get('content-type') || '').toLowerCase();
                return { ok: true, contentType, webp: contentType.includes('webp') };
            }
            // A 404 right after upload can be CDN propagation; retry briefly.
            lastStatus = `HTTP ${response.status}`;
        } catch (error) {
            lastStatus = error.message;
        }
        if (attempt < 3) await sleep(2000 * attempt);
    }
    return { ok: false, contentType: '', webp: false, detail: `HEAD not OK (${lastStatus})` };
}

// ---------------------------------------------------------------------------
// Image optimization
// ---------------------------------------------------------------------------

async function optimizeImageBuffer(originalBuffer, { quality, maxSize }) {
    const { default: sharp } = await import('sharp');

    const metadata = await sharp(originalBuffer, { failOn: 'none' }).metadata();
    if (!metadata.width || !metadata.height) {
        throw new Error('Could not read image dimensions');
    }

    const needsResize = metadata.width > maxSize || metadata.height > maxSize;

    const { data, info } = await sharp(originalBuffer, { failOn: 'none' })
        .rotate() // EXIF auto-orient so bottle labels always face the right way
        .resize({
            width: maxSize,
            height: maxSize,
            fit: 'inside',
            withoutEnlargement: true, // never upscale smaller images
        })
        .webp({
            quality,
            alphaQuality: 100, // keep transparency crisp
            effort: 4,
            // Full chroma (no subsampling) preserves fine bottle-label detail.
            smartSubsample: false,
        })
        .toBuffer({ resolveWithObject: true });

    return {
        buffer: data,
        bytes: info.size,
        width: info.width,
        height: info.height,
        originalWidth: metadata.width,
        originalHeight: metadata.height,
        originalFormat: metadata.format,
        hadAlpha: Boolean(metadata.hasAlpha),
        needsResize,
    };
}

// ---------------------------------------------------------------------------
// Database updates (guarded so concurrent edits are never clobbered)
// ---------------------------------------------------------------------------

async function updatePrimaryImageUrl(productId, newUrl, expectedCurrentUrl) {
    const result = await query(
        `UPDATE products
         SET image_url = $1, updated_at = NOW()
         WHERE id = $2 AND image_url = $3 AND image_url IS DISTINCT FROM $1`,
        [newUrl, productId, expectedCurrentUrl]
    );
    if (result.rowCount > 0) return { status: 'updated' };
    const current = await query('SELECT image_url FROM products WHERE id = $1', [productId]);
    const value = current.rows[0]?.image_url ?? null;
    if (value === newUrl) return { status: 'already' };
    return { status: 'mismatch', currentValue: value };
}

async function updateGalleryImageUrl(productId, index, newUrl, expectedCurrentUrl) {
    return withTransaction(async (client) => {
        const current = await client.query(
            'SELECT image_urls FROM products WHERE id = $1 FOR UPDATE',
            [productId]
        );
        const urls = current.rows[0]?.image_urls;
        if (!Array.isArray(urls)) {
            return { status: 'mismatch', currentValue: null };
        }
        if (index >= urls.length) {
            return { status: 'mismatch', currentValue: `index ${index} out of bounds (${urls.length})` };
        }
        if (urls[index] === newUrl) return { status: 'already' };
        if (urls[index] !== expectedCurrentUrl) {
            return { status: 'mismatch', currentValue: urls[index] };
        }
        // Replace in place: gallery length and ordering stay identical.
        const next = [...urls];
        next[index] = newUrl;
        await client.query('UPDATE products SET image_urls = $1, updated_at = NOW() WHERE id = $2', [
            JSON.stringify(next),
            productId,
        ]);
        return { status: 'updated' };
    });
}

// ---------------------------------------------------------------------------
// Work collection (paginated) + concurrency pool
// ---------------------------------------------------------------------------

async function collectProducts(options) {
    const products = [];
    let lastId = 0;
    for (;;) {
        const params = [lastId, options.pageSize];
        let sql = `SELECT id, name, image_url, image_urls
                   FROM products WHERE id > $1`;
        if (options.productId !== null) {
            sql += ' AND id = $3';
            params.push(options.productId);
        }
        sql += ' ORDER BY id ASC LIMIT $2';
        const page = await query(sql, params);
        if (page.rows.length === 0) break;
        products.push(...page.rows);
        lastId = page.rows[page.rows.length - 1].id;
        if (options.productId !== null) break;
        if (page.rows.length < options.pageSize) break;
    }
    return products;
}

// Returns unique image URLs -> the DB refs that point at each one.
function buildImageQueue(products) {
    const byUrl = new Map();
    for (const product of products) {
        const refs = [];
        if (product.image_url) {
            refs.push({
                productId: product.id,
                productName: product.name,
                field: 'image_url',
                index: null,
                url: product.image_url,
            });
        }
        const gallery = Array.isArray(product.image_urls) ? product.image_urls : [];
        gallery.forEach((url, index) => {
            if (url) {
                refs.push({
                    productId: product.id,
                    productName: product.name,
                    field: 'image_urls',
                    index,
                    url,
                });
            }
        });
        for (const ref of refs) {
            const existing = byUrl.get(ref.url);
            if (existing) existing.refs.push(ref);
            else byUrl.set(ref.url, { url: ref.url, refs: [ref] });
        }
    }
    return byUrl;
}

async function runPool(items, concurrency, worker, delayMs) {
    const queue = [...items];
    const runners = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        while (queue.length > 0) {
            const item = queue.shift();
            if (!item) break;
            await worker(item);
            if (delayMs > 0 && queue.length > 0) await sleep(delayMs);
        }
    });
    await Promise.all(runners);
}

// ---------------------------------------------------------------------------
// Journal (crash-safe JSONL; also the rollback artifact)
// ---------------------------------------------------------------------------

function createJournal(options, mode) {
    const logsDir = path.join(__dirname, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    const file = path.join(logsDir, `image-opt-journal-${mode}-${startedAtIso}.jsonl`);
    const header = {
        type: 'header',
        version: 1,
        mode,
        startedAt: new Date().toISOString(),
        bucket,
        options: {
            quality: options.quality,
            maxSize: options.maxSize,
            concurrency: options.concurrency,
            pageSize: options.pageSize,
            limit: options.limit,
            productId: options.productId,
        },
    };
    fs.writeFileSync(file, `${JSON.stringify(header)}\n`);
    return {
        file,
        append(entry) {
            fs.appendFileSync(file, `${JSON.stringify({ type: 'change', ...entry })}\n`);
        },
        finish(summary) {
            fs.appendFileSync(
                file,
                `${JSON.stringify({ type: 'summary', finishedAt: new Date().toISOString(), summary })}\n`
            );
        },
    };
}

// ---------------------------------------------------------------------------
// Optimize mode
// ---------------------------------------------------------------------------

async function optimize(options) {
    const stats = {
        productsScanned: 0,
        imagesDiscovered: 0,
        uniqueImages: 0,
        optimized: 0,
        reusedUploads: 0, // optimized file already in storage (rerun)
        skippedAlreadyOptimized: 0,
        skippedNoBenefit: 0,
        skippedNotInSupabase: 0,
        skippedUnsupported: 0,
        skippedLimit: 0,
        failed: 0,
        dbUpdated: 0,
        dbAlready: 0,
        dbMismatch: 0,
        originalBytes: 0,
        optimizedBytes: 0,
    };
    const failures = [];
    const journal = options.apply ? createJournal(options, 'optimize') : null;

    log(`MODE            : ${options.apply ? 'APPLY (uploads + DB updates)' : 'DRY RUN (read-only)'}`);
    log(`storage bucket  : ${bucket}`);
    log(`webp quality    : ${options.quality}`);
    log(`max dimension   : ${options.maxSize}x${options.maxSize} (no upscaling)`);
    log(`concurrency     : ${options.concurrency} (page size ${options.pageSize}, delay ${options.delayMs}ms)`);

    const products = await collectProducts(options);
    stats.productsScanned = products.length;
    const queue = buildImageQueue(products);
    stats.imagesDiscovered = [...queue.values()].reduce((sum, item) => sum + item.refs.length, 0);
    stats.uniqueImages = queue.size;
    log(`products        : ${stats.productsScanned}`);
    log(`image refs      : ${stats.imagesDiscovered} (${stats.uniqueImages} unique files)`);

    let remaining = options.limit > 0 ? options.limit : Infinity;
    const work = [];
    for (const item of queue.values()) {
        if (remaining <= 0) {
            stats.skippedLimit += item.refs.length;
            continue;
        }
        remaining -= 1;
        work.push(item);
    }

    await runPool(
        work,
        options.concurrency,
        async (item) => {
            try {
                await processImage(item, options, stats, journal, failures);
            } catch (error) {
                stats.failed += 1;
                failures.push({ url: safeUrl(item.url), error: error.message });
                logError(`FAILED ${safeUrl(item.url)} :: ${error.message}`);
            }
        },
        options.delayMs
    );

    const savedBytes = stats.originalBytes - stats.optimizedBytes;
    const savedPercent = stats.originalBytes ? percentSaved(stats.originalBytes, stats.optimizedBytes) : 0;

    log('================ SUMMARY ================');
    log(`mode                 : ${options.apply ? 'APPLY' : 'DRY RUN'}`);
    log(`products scanned     : ${stats.productsScanned}`);
    log(`image refs discovered: ${stats.imagesDiscovered} (${stats.uniqueImages} unique files)`);
    log(`optimized            : ${stats.optimized}`);
    log(`  reused existing    : ${stats.reusedUploads} (-opt.webp already in storage)`);
    log(`skipped already opt. : ${stats.skippedAlreadyOptimized}`);
    log(`skipped no benefit   : ${stats.skippedNoBenefit} (WebP not smaller than original)`);
    log(`skipped not supabase : ${stats.skippedNotInSupabase}`);
    log(`skipped unsupported  : ${stats.skippedUnsupported}`);
    log(`skipped (limit)      : ${stats.skippedLimit}`);
    log(`failed               : ${stats.failed}`);
    if (options.apply) {
        log(`DB urls updated      : ${stats.dbUpdated} (already current: ${stats.dbAlready}, mismatch: ${stats.dbMismatch})`);
        log(`journal              : ${journal.file}`);
    }
    log(`original size (total): ${formatBytes(stats.originalBytes)}`);
    log(`optimized size(total): ${formatBytes(stats.optimizedBytes)}`);
    log(`estimated savings    : ${formatBytes(savedBytes)} (${savedPercent.toFixed(1)}%)`);
    if (failures.length > 0) {
        log('failures:');
        for (const failure of failures) log(`  - ${failure.url} :: ${failure.error}`);
    }
    if (!options.apply) {
        log('DRY RUN COMPLETE - nothing was uploaded or modified.');
        log('Run the real migration with: node optimize-product-images.js --apply');
    } else if (journal) {
        journal.finish(stats);
        log(`To roll back: node optimize-product-images.js --rollback ${journal.file}`);
    }
    log('========================================');

    return stats.failed === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Per-image pipeline
// ---------------------------------------------------------------------------

async function processImage(item, options, stats, journal) {
    const { url } = item;
    const label = (ref) => `product=${ref.productId} ${ref.field}${ref.index !== null ? `[${ref.index}]` : ''}`;

    // Idempotency: never re-process an already-optimized file.
    const storagePath = getStoragePath(url);
    if (!storagePath) {
        stats.skippedNotInSupabase += item.refs.length;
        for (const ref of item.refs) log(`SKIP  [not-supabase] ${label(ref)} ${safeUrl(url)}`);
        return;
    }

    const ext = path.posix.extname(storagePath).toLowerCase();
    const slash = storagePath.lastIndexOf('/');
    const dir = slash === -1 ? '' : storagePath.slice(0, slash);
    const base = slash === -1 ? storagePath : storagePath.slice(slash + 1);
    const stem = base.slice(0, base.length - ext.length);

    if (stem.endsWith(OPTIMIZED_MARKER)) {
        stats.skippedAlreadyOptimized += item.refs.length;
        for (const ref of item.refs) log(`SKIP  [already-opt]  ${label(ref)} ${safeUrl(url)}`);
        return;
    }

    if (!SUPPORTED_EXTENSIONS.has(ext)) {
        stats.skippedUnsupported += item.refs.length;
        for (const ref of item.refs) log(`SKIP  [unsupported]  ${label(ref)} ext=${ext || 'none'} ${safeUrl(url)}`);
        return;
    }

    const optimizedBase = `${stem}${OPTIMIZED_SUFFIX}`;
    const optimizedPath = dir ? `${dir}/${optimizedBase}` : optimizedBase;
    const optimizedUrl = publicUrlFor(optimizedPath);

    // Fast rerun path: the -opt.webp already exists in storage -> only the DB
    // pointers need to catch up (guarded); no re-download or re-upload.
    const existingObject = await findStorageObject(optimizedPath);
    if (existingObject) {
        const originalBytes = await sizeOfOriginal(storagePath);
        const optimizedBytes = Number(existingObject.metadata?.size ?? existingObject.size ?? 0);
        stats.optimized += 1;
        stats.reusedUploads += 1;
        stats.originalBytes += originalBytes;
        stats.optimizedBytes += optimizedBytes;
        log(
            `EXISTS [optimized]   ${label(item.refs[0])} ${safeUrl(optimizedBase)} ` +
            `(${formatBytes(originalBytes)} -> ${formatBytes(optimizedBytes)}, ` +
            `${percentSaved(originalBytes, optimizedBytes).toFixed(1)}% saved, reused existing upload)`
        );
        if (!options.apply) {
            for (const ref of item.refs) {
                log(`      plan DB update  ${label(ref)}: ${safeUrl(ref.url)} -> ${safeUrl(optimizedUrl)}`);
            }
            return;
        }
        await applyDatabaseUpdates(item.refs, url, optimizedUrl, options, stats, journal, {
            originalPath: storagePath,
            optimizedPath,
            originalBytes,
            optimizedBytes,
            originalWidth: null,
            originalHeight: null,
            optimizedWidth: null,
            optimizedHeight: null,
            reusedUpload: true,
        });
        return;
    }

    // Download + transcode (also runs in dry run to produce real numbers).
    const originalBuffer = await downloadObject(storagePath);
    const originalBytes = originalBuffer.length;
    const optimized = await optimizeImageBuffer(originalBuffer, {
        quality: options.quality,
        maxSize: options.maxSize,
    });

    // Keep the original when WebP brings no gain and no resize was needed.
    if (optimized.bytes >= originalBytes && !optimized.needsResize) {
        stats.skippedNoBenefit += item.refs.length;
        log(
            `SKIP  [no-benefit]   ${label(item.refs[0])} ${safeUrl(base)} ` +
            `(${formatBytes(originalBytes)} -> ${formatBytes(optimized.bytes)} WebP, ` +
            `${optimized.originalWidth}x${optimized.originalHeight})`
        );
        return;
    }

    stats.optimized += 1;
    stats.originalBytes += originalBytes;
    stats.optimizedBytes += optimized.bytes;

    const savings = percentSaved(originalBytes, optimized.bytes).toFixed(1);
    log(
        `${options.apply ? 'OPT   ' : 'PLAN  '} [optimized]    ${label(item.refs[0])} ${safeUrl(base)} -> ${safeUrl(optimizedBase)} ` +
        `(${optimized.originalWidth}x${optimized.originalHeight} ${formatBytes(originalBytes)} -> ` +
        `${optimized.width}x${optimized.height} ${formatBytes(optimized.bytes)}, ${savings}% saved` +
        `${optimized.hadAlpha ? ', alpha kept' : ''}${optimized.needsResize ? `, resized to <=${options.maxSize}px` : ''})`
    );

    if (!options.apply) {
        // Dry run: report the planned DB changes without touching anything.
        for (const ref of item.refs) {
            log(`      plan DB update  ${label(ref)}: ${safeUrl(ref.url)} -> ${safeUrl(optimizedUrl)}`);
        }
        return;
    }

    const uploaded = await uploadOptimized(optimized.buffer, optimizedPath);
    log(`      uploaded       ${safeUrl(uploaded.path)}${uploaded.alreadyExisted ? ' (already existed)' : ''}`);

    const verification = await verifyOptimizedImage(uploaded.url);
    if (!verification.ok) {
        throw new Error(`Upload verification failed for ${safeUrl(uploaded.url)}: ${verification.detail}`);
    }
    if (!verification.webp) {
        logWarn(`verification: content-type "${verification.contentType}" is not image/webp for ${safeUrl(uploaded.url)}`);
    }
    log('      verified       HEAD 2xx on public URL');

    // DB update happens strictly AFTER successful upload + verification.
    await applyDatabaseUpdates(item.refs, url, uploaded.url, options, stats, journal, {
        originalPath: storagePath,
        optimizedPath: uploaded.path,
        originalBytes,
        optimizedBytes: optimized.bytes,
        originalWidth: optimized.originalWidth,
        originalHeight: optimized.originalHeight,
        optimizedWidth: optimized.width,
        optimizedHeight: optimized.height,
        reusedUpload: uploaded.alreadyExisted,
    });
}

async function sizeOfOriginal(storagePath) {
    try {
        const object = await findStorageObject(storagePath);
        return Number(object?.metadata?.size ?? object?.size ?? 0);
    } catch {
        return 0;
    }
}

async function applyDatabaseUpdates(refs, oldUrl, newUrl, options, stats, journal, fileDetails) {
    for (const ref of refs) {
        const suffix = `${ref.field}${ref.index !== null ? `[${ref.index}]` : ''}`;
        const result =
            ref.field === 'image_url'
                ? await updatePrimaryImageUrl(ref.productId, newUrl, oldUrl)
                : await updateGalleryImageUrl(ref.productId, ref.index, newUrl, oldUrl);

        if (result.status === 'updated') {
            stats.dbUpdated += 1;
            log(`      db updated     product=${ref.productId} ${suffix}`);
        } else if (result.status === 'already') {
            stats.dbAlready += 1;
            log(`      db already     product=${ref.productId} ${suffix}`);
        } else {
            stats.dbMismatch += 1;
            logWarn(
                `db mismatch (not overwritten) product=${ref.productId} ${suffix} ` +
                `current=${safeUrl(String(result.currentValue))}`
            );
        }

        if (journal && result.status !== 'mismatch') {
            journal.append({
                productId: ref.productId,
                productName: ref.productName,
                field: ref.field,
                galleryIndex: ref.index,
                originalUrl: ref.url,
                optimizedUrl: newUrl,
                ...fileDetails,
                appliedAt: new Date().toISOString(),
            });
        }
    }
}

// ---------------------------------------------------------------------------
// Rollback mode (restores previous URLs from a journal; deletes nothing)
// ---------------------------------------------------------------------------

async function rollback(journalFile) {
    const absolute = path.resolve(journalFile);
    if (!fs.existsSync(absolute)) {
        throw new Error(`Journal file not found: ${absolute}`);
    }
    const lines = fs.readFileSync(absolute, 'utf8').split(/\r?\n/).filter(Boolean);
    const entries = [];
    for (const line of lines) {
        try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'change') entries.push(parsed);
        } catch {
            logWarn('Skipping malformed journal line');
        }
    }
    log(`ROLLBACK from ${absolute}`);
    log(`entries to restore: ${entries.length}`);

    const stats = { restored: 0, already: 0, mismatch: 0, failed: 0 };
    for (const entry of entries) {
        const suffix = `${entry.field}${entry.galleryIndex !== null ? `[${entry.galleryIndex}]` : ''}`;
        try {
            const result =
                entry.field === 'image_url'
                    ? await updatePrimaryImageUrl(entry.productId, entry.originalUrl, entry.optimizedUrl)
                    : await updateGalleryImageUrl(entry.productId, entry.galleryIndex, entry.originalUrl, entry.optimizedUrl);

            if (result.status === 'updated') {
                stats.restored += 1;
                log(`RESTORED product=${entry.productId} ${suffix} -> ${safeUrl(entry.originalUrl)}`);
            } else if (result.status === 'already') {
                stats.already += 1;
                log(`ALREADY  product=${entry.productId} ${suffix}`);
            } else {
                stats.mismatch += 1;
                logWarn(
                    `MISMATCH product=${entry.productId} ${suffix} ` +
                    `current=${safeUrl(String(result.currentValue))} - not overwritten`
                );
            }
        } catch (error) {
            stats.failed += 1;
            logError(`FAILED product=${entry.productId} ${suffix}: ${error.message}`);
        }
    }

    log('================ ROLLBACK SUMMARY ================');
    log(`restored : ${stats.restored}`);
    log(`already  : ${stats.already}`);
    log(`mismatch : ${stats.mismatch} (URLs changed since optimization; left untouched)`);
    log(`failed   : ${stats.failed}`);
    log('Optimized -opt.webp files were NOT deleted (originals were never removed).');
    log('==================================================');
    return stats.failed === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
    const options = parseArgs(process.argv.slice(2));

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase Storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
    }
    if (!config.database.url) {
        throw new Error('DATABASE_URL is required');
    }

    const { default: sharp } = await import('sharp'); // throws if not installed
    log(`sharp             : ${sharp.versions?.sharp || 'loaded'}`);

    if (options.rollback) {
        return rollback(options.rollback);
    }
    return optimize(options);
}

main()
    .then(async (exitCode) => {
        try {
            await closeDb();
        } catch {
            // pool may already be closed
        }
        process.exit(exitCode ?? 0);
    })
    .catch(async (error) => {
        logError(error.stack || error.message);
        try {
            await closeDb();
        } catch {
            // pool may already be closed
        }
        process.exit(1);
    });
