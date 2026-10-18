import { logger } from '../../../../shared/logging/logger.js';
import {
    optimizeProductImage,
    isAllowedMimeType,
} from '../../../../shared/images/webp-optimizer.js';

/**
 * UploadProductImageUseCase - Business logic for uploading product images
 * 
 * Responsibilities:
 * - Validate file (MIME type, actual contents, size, dimensions)
 * - Optimize new images server-side: WebP quality 93, max 1600x1600,
 *   no upscaling, transparency and EXIF orientation preserved
 * - Generate safe filename
 * - Coordinate storage upload
 * - Return upload result
 * 
 * This use case is testable with a mocked storage adapter.
 *
 * Failure safety: validation and optimization run entirely in memory BEFORE
 * any storage write, so a failure there cannot leave orphaned files. If the
 * storage write itself fails, no URL is returned and the caller can never
 * persist an incorrect database URL. Everything runs in memory (multer
 * memoryStorage + sharp buffers) — no temporary files are created, and the
 * input buffer is released when this call returns.
 */

class UploadProductImageUseCase {
    constructor(storage) {
        this.storage = storage;
    }

    async execute(file, productId) {
        try {
            if (!file) {
                throw new Error('No file provided');
            }

            if (!isAllowedMimeType(file.mimetype)) {
                throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
            }

            // Validate contents/size/dimensions and produce the upload bytes.
            // Already-optimized WebP images pass through without re-encoding.
            const optimized = await optimizeProductImage(file);

            const safeProductId = String(productId || 'new').replace(/[^a-zA-Z0-9_-]/g, '-');
            const uploaded = await this.storage.uploadProductImage(
                { buffer: optimized.buffer, mimetype: optimized.mimetype },
                `products/product-${safeProductId}/image-${Date.now()}.${optimized.extension}`
            );

            if (!uploaded || !uploaded.path || !uploaded.url) {
                // The storage write happened but the result is unusable —
                // remove the object when we can address it so no orphan file
                // lingers without a database URL pointing at it.
                await this.cleanupUpload(uploaded, productId);
                throw new Error('Storage upload did not return a usable image URL');
            }

            logger.info('[UPLOAD_PRODUCT_IMAGE]', {
                productId,
                filename: uploaded.path,
                optimized: optimized.reencoded,
            });

            return uploaded;
        } catch (error) {
            logger.error('[UPLOAD_PRODUCT_IMAGE_ERROR]', { 
                productId, 
                errorMessage: error.message 
            });
            throw error;
        }
    }

    // Best-effort removal of a partially recorded upload. Failures are logged
    // (message only — never image contents or credentials) and never mask the
    // original error.
    async cleanupUpload(uploaded, productId) {
        if (!uploaded || typeof uploaded.url !== 'string' || typeof this.storage?.removeProductImage !== 'function') {
            return;
        }
        try {
            await this.storage.removeProductImage(uploaded.url);
        } catch (cleanupError) {
            logger.error('[UPLOAD_PRODUCT_IMAGE_CLEANUP_ERROR]', {
                productId,
                errorMessage: cleanupError.message
            });
        }
    }
}

export default UploadProductImageUseCase;
