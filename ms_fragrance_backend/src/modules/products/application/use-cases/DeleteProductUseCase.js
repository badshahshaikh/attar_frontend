import NotFoundError from '../../../../core/errors/NotFoundError.js';
import { logger } from '../../../../shared/logging/logger.js';

/**
 * DeleteProductUseCase - Business logic for deleting a product
 * 
 * Responsibilities:
 * - Check product existence
 * - Coordinate repository deletion
 * - Handle image cleanup
 * 
 * This use case is testable with a mocked repository.
 */

class DeleteProductUseCase {
    constructor(productRepository, storage) {
        this.productRepository = productRepository;
        this.storage = storage;
    }

    async cleanupImage(imageUrl, productId = null) {
        if (!this.storage || !this.storage.getStoragePath(imageUrl)) return;
        try {
            await this.storage.removeProductImage(imageUrl);
        } catch (error) {
            logger.error('[PRODUCT_DELETE_ERROR]', { 
                stage: 'supabase_delete', 
                productId, 
                errorCode: error.code || null, 
                errorMessage: error.message 
            });
        }
    }

    async execute(id) {
        try {
            // Get existing product for image cleanup
            const existing = await this.productRepository.findImageById(id);
            
            // Delete from repository
            const deleted = await this.productRepository.delete(id);
            
            if (!deleted) {
                throw new NotFoundError(`Product with ID ${id} not found`);
            }
            
            // Cleanup image
            if (existing) {
                const urls = [
                    existing.image_url,
                    ...(Array.isArray(existing.image_urls) ? existing.image_urls : [])
                ].filter(Boolean);

                for (const url of new Set(urls)) {
                    await this.cleanupImage(url, id);
                }
            }
            
            logger.info('[DELETE_PRODUCT]', { productId: id });
            
            return deleted;
        } catch (error) {
            logger.error('[DELETE_PRODUCT_ERROR]', { 
                productId: id, 
                errorMessage: error.message 
            });
            throw error;
        }
    }
}

export default DeleteProductUseCase;
