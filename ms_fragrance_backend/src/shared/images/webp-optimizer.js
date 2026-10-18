import sharp from 'sharp';

/**
 * WebP product image optimizer (server-side, upload path).
 *
 * Validates and normalizes every newly uploaded product image before it is
 * sent to Supabase Storage:
 *  - MIME whitelist: JPEG / PNG / WebP (must match the multer file filter).
 *  - Actual file contents must decode as one of those formats (rejects
 *    spoofed MIME types, truncated or non-image bytes).
 *  - Hard file-size cap (matches the 5 MB multer limit) and a pixel cap to
 *    defend against decompression bombs.
 *  - EXIF orientation is baked into the pixels (`.rotate()`), transparency is
 *    preserved (`alphaQuality: 100`), and label colour edges stay crisp with
 *    Sharp's high-quality chroma subsampling (`smartSubsample: true`).
 *  - Output: WebP quality 93, resized to fit inside 1600x1600 with
 *    `withoutEnlargement` so smaller images are never upscaled.
 *  - Already-optimized WebP inputs within the size budget are passed through
 *    byte-for-byte so images are not re-encoded (and degraded) for nothing.
 *
 * Works entirely in memory: no temporary files are ever written, and the
 * input buffer becomes garbage-collectable as soon as the call returns.
 * Throws plain Error with safe messages — never includes image contents or
 * credentials.
 */

const WEBP_QUALITY = 93;
const MAX_DIMENSION = 1600;
const MAX_INPUT_BYTES = 5 * 1024 * 1024; // keep in sync with multer limits
const MAX_INPUT_PIXELS = 40_000_000; // 40 MP decompression-bomb guard

// MIME type -> sharp format reported by metadata()
const ALLOWED_MIME_TYPES = new Map([
    ['image/jpeg', 'jpeg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
]);

// Actual decodable formats (sharp reports 'jpeg' for JPEG files)
const ALLOWED_FORMATS = new Set(['jpeg', 'jpg', 'png', 'webp']);

function isAllowedMimeType(mimetype) {
    return ALLOWED_MIME_TYPES.has(mimetype);
}

function assertUploadable(file) {
    if (!file || !file.buffer || file.buffer.length === 0) {
        throw new Error('No image data provided');
    }
    if (!isAllowedMimeType(file.mimetype)) {
        throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
    }
    if (file.buffer.length > MAX_INPUT_BYTES) {
        throw new Error('Image exceeds the 5 MB upload limit');
    }
}

/**
 * Validate `file` and return the bytes to upload.
 *
 * @param {{ buffer: Buffer, mimetype: string }} file
 * @returns {Promise<{ buffer: Buffer, mimetype: string, extension: string,
 *   reencoded: boolean, width: number, height: number }>}
 * @throws {Error} when the file is missing, oversized, not a supported image,
 *   or cannot be decoded/encoded.
 */
async function optimizeProductImage(file) {
    assertUploadable(file);

    // Stage 1: decode metadata (cheap header read). Catches spoofed MIME types
    // and corrupt/truncated files before any storage write can happen.
    let metadata;
    try {
        metadata = await sharp(file.buffer).metadata();
    } catch {
        throw new Error('File contents are not a valid image');
    }

    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
        // sharp reports 'jpeg' (or legacy 'jpg'); anything else (svg, gif,
        // heif, text sniffed as no format, ...) is rejected.
        throw new Error('File contents are not a valid image');
    }
    if (!metadata.width || !metadata.height) {
        throw new Error('Unable to determine image dimensions');
    }
    if (metadata.width * metadata.height > MAX_INPUT_PIXELS) {
        throw new Error('Image dimensions exceed the allowed limit');
    }

    // Stage 2: skip re-encoding when the input is already a WebP that fits
    // the 1600x1600 budget (e.g. a previous optimization result).
    if (
        metadata.format === 'webp' &&
        metadata.width <= MAX_DIMENSION &&
        metadata.height <= MAX_DIMENSION
    ) {
        return {
            buffer: file.buffer,
            mimetype: 'image/webp',
            extension: 'webp',
            reencoded: false,
            width: metadata.width,
            height: metadata.height,
        };
    }

    // Stage 3: re-encode. `.rotate()` applies EXIF orientation first so
    // bottle labels stay upright in the flattened output.
    let result;
    try {
        result = await sharp(file.buffer)
            .rotate()
            .resize({
                width: MAX_DIMENSION,
                height: MAX_DIMENSION,
                fit: 'inside',
                withoutEnlargement: true,
            })
            .webp({
                quality: WEBP_QUALITY,
                alphaQuality: 100,
                // Sharp documents smartSubsample:true as "use high quality
                // chroma subsampling" (default false) — keeps bottle-label
                // text and colour edges crisp at a small size cost.
                smartSubsample: true,
                effort: 4,
            })
            .toBuffer({ resolveWithObject: true });
    } catch {
        throw new Error('Image could not be processed');
    }

    return {
        buffer: result.data,
        mimetype: 'image/webp',
        extension: 'webp',
        reencoded: true,
        width: result.info.width,
        height: result.info.height,
    };
}

export {
    optimizeProductImage,
    isAllowedMimeType,
    WEBP_QUALITY,
    MAX_DIMENSION,
    MAX_INPUT_BYTES,
    MAX_INPUT_PIXELS,
};
