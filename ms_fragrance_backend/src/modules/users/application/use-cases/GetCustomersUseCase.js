import { toCustomer } from '../../user.mapper.js';
import { logger } from '../../../../shared/logging/logger.js';

/**
 * GetCustomersUseCase - Business logic for listing registered customers
 *
 * Responsibilities:
 * - Coordinate repository for customer retrieval
 * - Apply pagination logic
 * - Transform database rows to API customers
 *
 * This use case is testable with a mocked repository.
 */
class GetCustomersUseCase {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }

    async execute(filters) {
        try {
            const { rows, total } = await this.userRepository.findAllCustomers(filters);
            const totalPages = Math.ceil(total / filters.limit);

            return {
                customers: rows.map(toCustomer),
                pagination: {
                    page: filters.page,
                    limit: filters.limit,
                    totalCustomers: total,
                    totalPages,
                    hasNextPage: filters.page < totalPages,
                    hasPreviousPage: filters.page > 1
                }
            };
        } catch (error) {
            logger.error('[GET_CUSTOMERS_ERROR]', { errorMessage: error.message });
            throw error;
        }
    }
}

export default GetCustomersUseCase;