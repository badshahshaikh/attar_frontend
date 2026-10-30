import { toProduct, toPersistenceValues } from '../../product.mapper.js';
import { parseProductPayload, ensureSizeConsistency } from '../../product.validator.js';
import NotFoundError from '../../../../core/errors/NotFoundError.js';
import { logger } from '../../../../shared/logging/logger.js';

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

            const previous = await this.productRepository.findImageById(id);

            // Slug handling on update:
            // - If the caller supplied a slug, use it (allows renaming/custom slugs).
            // - If no slug is supplied, preserve the existing slug so a manually
            //   customized slug is never unexpectedly overwritten or wiped to NULL.
            if (!normalized.slug) {
                normalized.slug = previous?.slug ?? null;
            }

            const persistenceValues = toPersistenceValues(normalized);

            logger.info('[PUT_TRACE]', {
                stage: 'after_toPersistenceValues',
                productId: id,
                sizePricing: persistenceValues[9],
                sizes: persistenceValues[10]
            });

            const row = await this.productRepository.update(
                id,
                persistenceValues
            );

            if (!row) {
                throw new NotFoundError(`Product with ID ${id} not found`);
            }

            const previousUrls = [
                previous?.image_url,
                ...(Array.isArray(previous?.image_urls) ? previous.image_urls : [])
            ].filter(Boolean);
            const nextUrls = new Set([
                row.image_url,
                ...(Array.isArray(row.image_urls) ? row.image_urls : [])
            ].filter(Boolean));
            const imageChanged = previousUrls.some(url => !nextUrls.has(url));

            for (const url of new Set(previousUrls)) {
                if (!nextUrls.has(url)) {
                    await this.cleanupImage(url, id);
                }
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

export default UpdateProductUseCase;
