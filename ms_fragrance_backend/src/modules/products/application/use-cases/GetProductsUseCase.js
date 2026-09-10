const { toProduct } = require('../../product.mapper');
const { logger } = require('../../../../shared/logging/logger');

/**
 * GetProductsUseCase - Business logic for retrieving products with filtering
 * 
 * Responsibilities:
 * - Coordinate repository for product retrieval
 * - Apply pagination logic
 * - Transform database rows to domain models
 * 
 * This use case is testable with a mocked repository.
 */

class GetProductsUseCase {
    constructor(productRepository) {
        this.productRepository = productRepository;
    }

    async execute(filters) {
        try {
            const { rows, total } = await this.productRepository.findAll(filters);
            const totalPages = Math.ceil(total / filters.limit);
            
            return {
                products: rows.map(toProduct),
                pagination: {
                    page: filters.page,
                    limit: filters.limit,
                    totalProducts: total,
                    totalPages,
                    hasNextPage: filters.page < totalPages,
                    hasPreviousPage: filters.page > 1
                }
            };
        } catch (error) {
            logger.error('[GET_PRODUCTS_ERROR]', { errorMessage: error.message });
            throw error;
        }
    }
}

module.exports = GetProductsUseCase;
