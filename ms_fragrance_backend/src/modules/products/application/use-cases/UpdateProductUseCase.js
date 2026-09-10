const { toProduct, toPersistenceValues } = require('../../product.mapper');
const { parseProductPayload, ensureSizeConsistency } = require('../../product.validator');
const NotFoundError = require('../../../../core/errors/NotFoundError');
const { logger } = require('../../../../shared/logging/logger');

/**
 * UpdateProductUseCase - Business logic for updating an existing product
 * 
 * Responsibilities:
 * - Validate product input
 * - Normalize size pricing consistency
 * - Check product existence
 * - Coordinate repository update
 * - Handle image cleanup if needed
 * - Transform to domain model
 * 
 * This use case is testable with a mocked repository.
 */

class UpdateProductUseCase {
    constructor(productRepository, storage) {
        this.productRepository = productRepository;
        this.storage = storage;
    }

    async cleanupImage(imageUrl, productId = null) {
        if (!this.storage || !this.storage.getStoragePath(imageUrl)) return;
        try {
            await this.storage.removeProductImage(imageUrl);
        } catch (error) {
            logger.error('[PRODUCT_UPDATE_ERROR]', { 
                stage: 'supabase_delete', 
                productId, 
                errorCode: error.code || null, 
                errorMessage: error.message 
            });
        }
    }

    async execute(id, productData) {
        try {
            logger.info('[PUT_TRACE]', { stage: 'use_case_start', productId: id });
            
            // Validate and normalize input
            const validated = parseProductPayload(productData);
            const normalized = ensureSizeConsistency(validated);
            
            // Get previous image for cleanup
            const previous = await this.productRepository.findImageById(id);
            
            // Update in repository
            const row = await this.productRepository.update(id, toPersistenceValues(normalized));
            
            if (!row) {
                throw new NotFoundError(`Product with ID ${id} not found`);
            }
            
            // Cleanup old image if changed
            const imageChanged = Boolean(previous && previous.image_url !== row.image_url);
            if (imageChanged) {
                await this.cleanupImage(previous.image_url, id);
            }
            
            logger.info('[PRODUCT_UPDATE]', { 
                stage: 'complete', 
                productId: id, 
                imageChanged 
            });
            
            return {
                product: toProduct(row),
                imageChanged
            };
        } catch (error) {
            logger.error('[PRODUCT_UPDATE_ERROR]', { 
                productId: id, 
                errorMessage: error.message 
            });
            throw error;
        }
    }
}

module.exports = UpdateProductUseCase;
