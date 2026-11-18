import { toProduct, toPartialPersistenceValues } from '../../product.mapper.js';
import { parsePartialProductPayload } from '../../product.validator.js';
import NotFoundError from '../../../../core/errors/NotFoundError.js';
import { logger } from '../../../../shared/logging/logger.js';

/**
 * UpdateProductUseCase - Business logic for updating an existing product
 *
 * Responsibilities:
 * - Validate only explicitly provided fields (partial update)
 * - Check product existence before updating
 * - Update only provided columns, preserving all omitted fields
 * - Handle image cleanup if image URLs changed
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
                incomingFields: Object.keys(productData || {})
            });

            // Verify product exists before attempting update
            const existing = await this.productRepository.findById(id);
            if (!existing) {
                throw new NotFoundError(`Product with ID ${id} not found`);
            }

            // Validate only explicitly provided fields; omitted fields are absent
            const validated = parsePartialProductPayload(productData);

            logger.info('[PUT_TRACE]', {
                stage: 'after_parsePartialProductPayload',
                productId: id,
                validatedFields: Object.keys(validated)
            });

            // Convert validated partial payload to column->value map.
            // Only provided columns are included; omitted fields are not touched.
            const updates = toPartialPersistenceValues(validated);

            logger.info('[PUT_TRACE]', {
                stage: 'after_toPartialPersistenceValues',
                productId: id,
                updateColumns: Object.keys(updates)
            });

            const row = await this.productRepository.update(id, updates);

            if (!row) {
                throw new NotFoundError(`Product with ID ${id} not found`);
            }

            const previousUrls = [
                existing?.image_url,
                ...(Array.isArray(existing?.image_urls) ? existing.image_urls : [])
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
