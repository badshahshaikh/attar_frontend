const { toProduct, toPersistenceValues } = require('../../product.mapper');
const { parseProductPayload, ensureSizeConsistency } = require('../../product.validator');
const { logger } = require('../../../../shared/logging/logger');

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

module.exports = CreateProductUseCase;
