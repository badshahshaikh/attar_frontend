import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

import UploadProductImageUseCase from '../../../src/modules/products/application/use-cases/UploadProductImageUseCase.js';
import UpdateProductUseCase from '../../../src/modules/products/application/use-cases/UpdateProductUseCase.js';
import { createProductController } from '../../../src/modules/products/product.controller.js';
import {
    optimizeProductImage,
    MAX_INPUT_BYTES,
    WEBP_QUALITY,
    MAX_DIMENSION,
} from '../../../src/shared/images/webp-optimizer.js';

// ---------------------------------------------------------------------------
// Fakes — Supabase Storage and the database are mocked; sharp runs for real.
// ---------------------------------------------------------------------------

function createFakeStorage({ uploadError = null, uploadResult = null } = {}) {
    const calls = { uploads: [], removed: [] };
    return {
        calls,
        async uploadProductImage(file, objectPath) {
            if (uploadError) throw uploadError;
            calls.uploads.push({ file, objectPath });
            return uploadResult !== null
                ? uploadResult
                : {
                      path: objectPath,
                      url: `https://storage.test/product-images/${objectPath}`,
                  };
        },
        async removeProductImage(imageUrl) {
            calls.removed.push(imageUrl);
            return true;
        },
        getStoragePath(imageUrl) {
            return typeof imageUrl === 'string' && imageUrl.includes('storage.test')
                ? imageUrl.replace('https://storage.test/product-images/', '')
                : null;
        },
    };
}

function pngFile(width, height, background = { r: 200, g: 30, b: 60, alpha: 0.5 }) {
    return sharp({ create: { width, height, channels: 4, background } })
        .png()
        .toBuffer()
        .then((buffer) => ({ buffer, mimetype: 'image/png' }));
}

// ---------------------------------------------------------------------------
// Approved optimizer settings (quality/perf trade-off is deliberate)
// ---------------------------------------------------------------------------

test('optimizer uses the approved WebP quality 93 and 1600x1600 cap', () => {
    assert.equal(WEBP_QUALITY, 93, 'WebP quality is 93 (was 85)');
    assert.equal(MAX_DIMENSION, 1600, 'max dimension is 1600 (was 1200)');
});

// ---------------------------------------------------------------------------
// Successful optimization
// ---------------------------------------------------------------------------

test('optimizes an uploaded PNG to WebP q93, resized inside 1600x1600, transparency kept', async () => {
    const storage = createFakeStorage();
    const useCase = new UploadProductImageUseCase(storage);
    const file = await pngFile(2400, 1800);

    const uploaded = await useCase.execute(file, 7);

    assert.equal(storage.calls.uploads.length, 1, 'exactly one storage write');
    const { file: sentFile, objectPath } = storage.calls.uploads[0];
    assert.equal(sentFile.mimetype, 'image/webp', 'uploads WebP content type');
    assert.match(objectPath, /^products\/product-7\/image-\d+\.webp$/, 'same folder/naming scheme, .webp output');

    const meta = await sharp(sentFile.buffer).metadata();
    assert.equal(meta.format, 'webp');
    assert.equal(meta.width, 1600, 'scaled down to the 1600px box');
    assert.equal(meta.height, 1200, 'aspect ratio preserved');
    assert.equal(meta.hasAlpha, true, 'transparency preserved');

    // Response shape consumed by the controller / admin frontend is unchanged.
    assert.deepEqual(uploaded, {
        path: objectPath,
        url: `https://storage.test/product-images/${objectPath}`,
    });
});

test('never upscales an image smaller than the 1600x1600 budget', async () => {
    const storage = createFakeStorage();
    const useCase = new UploadProductImageUseCase(storage);
    const file = await pngFile(480, 360, { r: 5, g: 120, b: 200, alpha: 1 });

    await useCase.execute(file, 9);

    const { file: sentFile } = storage.calls.uploads[0];
    const meta = await sharp(sentFile.buffer).metadata();
    assert.equal(meta.width, 480, 'width untouched');
    assert.equal(meta.height, 360, 'height untouched');
});

test('bakes EXIF orientation into the optimized output', async () => {
    const raw = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#336699' } })
        .withMetadata({ orientation: 6 })
        .jpeg()
        .toBuffer();
    const storage = createFakeStorage();
    const useCase = new UploadProductImageUseCase(storage);

    await useCase.execute({ buffer: raw, mimetype: 'image/jpeg' }, 11);

    const { file: sentFile } = storage.calls.uploads[0];
    const meta = await sharp(sentFile.buffer).metadata();
    assert.equal(meta.format, 'webp');
    assert.equal(meta.width, 200, 'rotated 90 degrees (orientation 6)');
    assert.equal(meta.height, 400);
});

test('passes an already-optimized small WebP through byte-for-byte (no re-encode)', async () => {
    const input = await sharp({ create: { width: 600, height: 600, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0.4 } } })
        .webp({ quality: 80 })
        .toBuffer();
    const storage = createFakeStorage();
    const useCase = new UploadProductImageUseCase(storage);

    await useCase.execute({ buffer: input, mimetype: 'image/webp' }, 12);

    const { file: sentFile } = storage.calls.uploads[0];
    assert.equal(sentFile.mimetype, 'image/webp');
    assert.equal(Buffer.compare(sentFile.buffer, input), 0, 'identical bytes = no unnecessary re-optimization');
});

test('passes a WebP within the 1600px budget through byte-for-byte (no re-encode)', async () => {
    const input = await sharp({ create: { width: 1400, height: 1400, channels: 4, background: { r: 10, g: 90, b: 160, alpha: 0.6 } } })
        .webp({ quality: 80 })
        .toBuffer();
    const storage = createFakeStorage();
    const useCase = new UploadProductImageUseCase(storage);

    await useCase.execute({ buffer: input, mimetype: 'image/webp' }, 14);

    const { file: sentFile } = storage.calls.uploads[0];
    assert.equal(Buffer.compare(sentFile.buffer, input), 0, '1400px WebP now fits the 1600 budget and passes through untouched');
});

test('resizes a WebP larger than the 1600 cap instead of passing it through', async () => {
    const input = await sharp({ create: { width: 1800, height: 1800, channels: 4, background: { r: 90, g: 12, b: 40, alpha: 0.7 } } })
        .webp({ quality: 80 })
        .toBuffer();
    const storage = createFakeStorage();
    const useCase = new UploadProductImageUseCase(storage);

    await useCase.execute({ buffer: input, mimetype: 'image/webp' }, 15);

    const { file: sentFile } = storage.calls.uploads[0];
    const meta = await sharp(sentFile.buffer).metadata();
    assert.equal(meta.format, 'webp');
    assert.equal(meta.width, 1600, 'capped to 1600px');
    assert.equal(meta.height, 1600);
    assert.equal(meta.hasAlpha, true, 'transparency preserved on re-encode');
});

// ---------------------------------------------------------------------------
// Invalid files
// ---------------------------------------------------------------------------

test('rejects a missing file before touching storage', async () => {
    const storage = createFakeStorage();
    const useCase = new UploadProductImageUseCase(storage);

    await assert.rejects(useCase.execute(undefined, 1), /No file provided/);
    assert.equal(storage.calls.uploads.length, 0);
});

test('rejects a disallowed MIME type before touching storage', async () => {
    const storage = createFakeStorage();
    const useCase = new UploadProductImageUseCase(storage);

    await assert.rejects(
        useCase.execute({ buffer: Buffer.from('GIF89a'), mimetype: 'image/gif' }, 1),
        /Invalid file type\. Only JPEG, PNG, and WebP are allowed\./
    );
    assert.equal(storage.calls.uploads.length, 0);
});

test('rejects spoofed contents that are not really an image', async () => {
    const storage = createFakeStorage();
    const useCase = new UploadProductImageUseCase(storage);
    const text = Buffer.from('<html>definitely not a png</html>');

    await assert.rejects(
        useCase.execute({ buffer: text, mimetype: 'image/png' }, 1),
        /not a valid image/
    );
    assert.equal(storage.calls.uploads.length, 0, 'nothing is uploaded for invalid bytes');
});

test('rejects files above the 5 MB size limit', async () => {
    const storage = createFakeStorage();
    const useCase = new UploadProductImageUseCase(storage);
    const oversized = Buffer.alloc(MAX_INPUT_BYTES + 1, 7);

    await assert.rejects(
        useCase.execute({ buffer: oversized, mimetype: 'image/png' }, 1),
        /5 MB upload limit/
    );
    assert.equal(storage.calls.uploads.length, 0);
});

test('rejects images whose pixel count exceeds the decompression-bomb guard', async () => {
    // 6400 x 6400 = 40.96 MP > 40 MP cap
    const bomb = await sharp({ create: { width: 6400, height: 6400, channels: 3, background: '#ffffff' } })
        .jpeg({ quality: 10 })
        .toBuffer();

    await assert.rejects(
        optimizeProductImage({ buffer: bomb, mimetype: 'image/jpeg' }),
        /dimensions exceed the allowed limit/
    );
});

// ---------------------------------------------------------------------------
// Storage failures
// ---------------------------------------------------------------------------

test('propagates storage upload failures without returning any URL', async () => {
    const storage = createFakeStorage({ uploadError: new Error('supabase unavailable') });
    const useCase = new UploadProductImageUseCase(storage);
    const file = await pngFile(64, 64);

    await assert.rejects(useCase.execute(file, 3), /supabase unavailable/);
    assert.equal(storage.calls.uploads.length, 0);
    assert.equal(storage.calls.removed.length, 0, 'nothing was written, so nothing to clean up');
});

test('cleans up an orphaned object when storage returns an unusable result', async () => {
    const storage = createFakeStorage({
        uploadResult: { path: null, url: 'https://storage.test/product-images/orphan.png' },
    });
    const useCase = new UploadProductImageUseCase(storage);
    const file = await pngFile(64, 64);

    await assert.rejects(useCase.execute(file, 3), /usable image URL/);
    assert.deepEqual(storage.calls.removed, ['https://storage.test/product-images/orphan.png'],
        'the orphaned object is removed instead of being left behind');
});

// ---------------------------------------------------------------------------
// Database failures
// ---------------------------------------------------------------------------

test('a database failure during product save rejects cleanly and never deletes the previous image', async () => {
    const storage = createFakeStorage();
    const repository = {
        findImageById: async () => ({
            image_url: 'https://storage.test/product-images/previous.png',
            image_urls: ['https://storage.test/product-images/gallery.png'],
        }),
        update: async () => {
            throw new Error('db connection lost');
        },
    };
    const useCase = new UpdateProductUseCase(repository, storage);

    const payload = {
        name: 'Rose Attar',
        brand: 'MS Fragrance',
        fragranceFamily: 'Oud',
        price: 999,
        sizes: [],
        sizePricing: {},
        topNotes: [],
        heartNotes: [],
        baseNotes: [],
        imageUrl: 'https://storage.test/product-images/new.webp',
        imageUrls: ['https://storage.test/product-images/new.webp'],
    };

    await assert.rejects(useCase.execute(42, payload), /db connection lost/);
    assert.equal(storage.calls.removed.length, 0,
        'existing image files stay untouched when the database write fails');
});

// ---------------------------------------------------------------------------
// Response format
// ---------------------------------------------------------------------------

test('controller upload response shape is unchanged', async () => {
    const controller = createProductController({
        uploadProductImageUseCase: {
            execute: async () => ({
                path: 'products/product-5/image-123.webp',
                url: 'https://storage.test/product-images/products/product-5/image-123.webp',
            }),
        },
    });
    const res = {
        statusCode: 200,
        body: null,
        status(code) {
            res.statusCode = code;
            return res;
        },
        json(payload) {
            res.body = payload;
            return res;
        },
    };

    await controller.uploadImage(
        { file: { buffer: Buffer.from('x'), mimetype: 'image/png' }, body: { productId: '5' } },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        imageUrl: 'https://storage.test/product-images/products/product-5/image-123.webp',
        filename: 'products/product-5/image-123.webp',
    });
});

test('controller keeps the existing 502 response and never emits an imageUrl on failure', async () => {
    const controller = createProductController({
        uploadProductImageUseCase: {
            execute: async () => {
                throw new Error('storage exploded');
            },
        },
    });
    const res = {
        statusCode: 200,
        body: null,
        status(code) {
            res.statusCode = code;
            return res;
        },
        json(payload) {
            res.body = payload;
            return res;
        },
    };

    await controller.uploadImage(
        { file: { buffer: Buffer.from('x'), mimetype: 'image/png' }, body: {} },
        res
    );

    assert.equal(res.statusCode, 502, 'response format preserved');
    assert.deepEqual(res.body, { error: 'Image upload failed' });
    assert.equal('imageUrl' in res.body, false, 'no URL reaches the client, so no wrong DB URL can be saved');
});


