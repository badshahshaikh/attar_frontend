import { toAdminOrder } from '../../order.mapper.js';
import { logger } from '../../../../shared/logging/logger.js';

/**
 * GetOrdersUseCase - Business logic for the admin order listing
 *
 * Responsibilities:
 * - Coordinate repository for order retrieval (search, filters, pagination)
 * - Apply pagination logic
 * - Transform joined database rows to API orders
 *
 * This use case is testable with a mocked repository.
 */
class GetOrdersUseCase {
    constructor(orderRepository) {
        this.orderRepository = orderRepository;
    }

    async execute(filters) {
        try {
            const { rows, total } = await this.orderRepository.findAllAdmin(filters);
            const totalPages = Math.ceil(total / filters.limit);

            return {
                orders: rows.map(toAdminOrder),
                pagination: {
                    page: filters.page,
                    limit: filters.limit,
                    totalOrders: total,
                    totalPages,
                    hasNextPage: filters.page < totalPages,
                    hasPreviousPage: filters.page > 1
                }
            };
        } catch (error) {
            logger.error('[GET_ORDERS_ERROR]', { errorMessage: error.message });
            throw error;
        }
    }
}

export default GetOrdersUseCase;