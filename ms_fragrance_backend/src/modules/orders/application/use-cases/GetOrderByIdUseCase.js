import { toAdminOrderDetail } from '../../order.mapper.js';
import { logger } from '../../../../shared/logging/logger.js';

/**
 * GetOrderByIdUseCase - Business logic for one admin order (View action)
 *
 * Returns the order with its shipping address, contact snapshot and
 * order_items, or null when the order does not exist.
 */
class GetOrderByIdUseCase {
    constructor(orderRepository) {
        this.orderRepository = orderRepository;
    }

    async execute(id) {
        try {
            const row = await this.orderRepository.findByIdAdmin(id);
            return toAdminOrderDetail(row);
        } catch (error) {
            logger.error('[GET_ORDER_BY_ID_ERROR]', { orderId: id, errorMessage: error.message });
            throw error;
        }
    }
}

export default GetOrderByIdUseCase;