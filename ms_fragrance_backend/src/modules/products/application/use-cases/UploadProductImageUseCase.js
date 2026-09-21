import { logger } from '../../../../shared/logging/logger.js';

/**
 * UploadProductImageUseCase - Business logic for uploading product images
 * 
 * Responsibilities:
 * - Validate file
 * - Generate safe filename
 * - Coordinate storage upload
 * - Return upload result
 * 
 * This use case is testable with a mocked storage adapter.
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

            const safeProductId = String(productId || 'new').replace(/[^a-zA-Z0-9_-]/g, '-');
            const extension = { 
                'image/jpeg': 'jpg', 
                'image/png': 'png', 
                'image/webp': 'webp' 
            }[file.mimetype];

            if (!extension) {
                throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
            }

            const uploaded = this.storage.uploadProductImage(
                file, 
                `products/product-${safeProductId}/image-${Date.now()}.${extension}`
            );

            logger.info('[UPLOAD_PRODUCT_IMAGE]', { 
                productId, 
                filename: uploaded.path 
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
}

export default UploadProductImageUseCase;
