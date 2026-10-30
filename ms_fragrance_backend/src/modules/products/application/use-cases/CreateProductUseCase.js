import { toProduct, toPersistenceValues } from '../../product.mapper.js';
import { parseProductPayload, ensureSizeConsistency, slugify } from '../../product.validator.js';
import { logger } from '../../../../shared/logging/logger.js';

/**
 * CreateProductUseCase - Business logic for creating a new product
 * 
 * Responsibilities:
 * - Validate product input
 * - Normalize size pricing consistency
 * - Coordinate repository creation
 * - Transform to domain model
 * 
 * This use case is testable with a mocked repository.
 */

class CreateProductUseCase {
    constructor(productRepository) {
        this.productRepository = productRepository;
    }

    async execute(productData) {
        try {
            // Validate and normalize input
            const validated = parseProductPayload(productData);
            
            // Ensure size pricing and sizes consistency
            const normalized = ensureSizeConsistency(validated);

            // Auto-generate a slug from the product name when none is supplied.
            // The slug is persisted as part of the creation operation so the
            // frontend can build canonical /product/{slug}-{id} URLs.
            if (!normalized.slug) {
                normalized.slug = slugify(normalized.name);
            }

            // Persist to repository
            const row = await this.productRepository.create(toPersistenceValues(normalized));
            
            logger.info('[CREATE_PRODUCT]', { productId: row.id, productName: row.name });
            
            return toProduct(row);
        } catch (error) {
            logger.error('[CREATE_PRODUCT_ERROR]', { errorMessage: error.message });
            throw error;
        }
    }
}

export default CreateProductUseCase;
