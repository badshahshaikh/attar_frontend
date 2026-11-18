import { toProduct } from '../../product.mapper.js';
import NotFoundError from '../../../../core/errors/NotFoundError.js';
import { logger } from '../../../../shared/logging/logger.js';

/**
 * ActivateProductUseCase - Business logic for activating an existing product
 *
 * Responsibilities:
 * - Verify product exists
 * - Set in_stock = true (activate)
 * - Update only the stock status field, preserving all other fields
 * - Transform to domain model
 */
class ActivateProductUseCase {
    constructor(productRepository) {
        this.productRepository = productRepository;
    }

    async execute(id) {
        try {
            const existing = await this.productRepository.findById(id);
            if (!existing) {
                throw new NotFoundError(`Product with ID ${id} not found`);
            }

            const row = await this.productRepository.updateStockStatus(id, true);
            if (!row) {
                throw new NotFoundError(`Product with ID ${id} not found`);
            }

            logger.info('[PRODUCT_ACTIVATE]', { productId: id, inStock: true });

            return toProduct(row);
        } catch (error) {
            logger.error('[PRODUCT_ACTIVATE_ERROR]', { productId: id, errorMessage: error.message });
            throw error;
        }
    }
}

export default ActivateProductUseCase;
