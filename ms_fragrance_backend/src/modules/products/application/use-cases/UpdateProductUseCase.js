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
            logger.info('[PUT_TRACE]', {
                stage: 'use_case_start',
                productId: id,
                incomingSizePricing: productData.sizePricing,
                incomingSizes: productData.sizes
            });

            const validated = parseProductPayload(productData);

            logger.info('[PUT_TRACE]', {
                stage: 'after_parseProductPayload',
                productId: id,
                sizePricing: validated.sizePricing,
                sizes: validated.sizes
            });

            const normalized = ensureSizeConsistency(validated);

            logger.info('[PUT_TRACE]', {
                stage: 'after_ensureSizeConsistency',
                productId: id,
                sizePricing: normalized.sizePricing,
                sizes: normalized.sizes
            });

            const persistenceValues = toPersistenceValues(normalized);

            logger.info('[PUT_TRACE]', {
                stage: 'after_toPersistenceValues',
                productId: id,
                sizePricing: persistenceValues[9],
                sizes: persistenceValues[10]
            });

            const previous = await this.productRepository.findImageById(id);

            const row = await this.productRepository.update(
                id,
                persistenceValues
            );

            if (!row) {
                throw new NotFoundError(`Product with ID ${id} not found`);
            }

            const imageChanged = Boolean(
                previous && previous.image_url !== row.image_url
            );

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
