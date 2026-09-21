import { toProduct } from '../../product.mapper.js';
import NotFoundError from '../../../../core/errors/NotFoundError.js';
import { logger } from '../../../../shared/logging/logger.js';

/**
 * GetProductByIdUseCase - Business logic for retrieving a single product by ID
 * 
 * Responsibilities:
 * - Fetch product from repository
 * - Transform to domain model
 * - Handle not found case
 * 
 * This use case is testable with a mocked repository.
 */

class GetProductByIdUseCase {
    constructor(productRepository) {
        this.productRepository = productRepository;
    }

    async execute(id) {
        try {
            const row = await this.productRepository.findById(id);
            
            if (!row) {
                throw new NotFoundError(`Product with ID ${id} not found`);
            }
            
            return toProduct(row);
        } catch (error) {
            logger.error('[GET_PRODUCT_BY_ID_ERROR]', { productId: id, errorMessage: error.message });
            throw error;
        }
    }
}

export default GetProductByIdUseCase;
