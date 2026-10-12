import { toReturn } from '../../return.mapper.js';
import { logger } from '../../../../shared/logging/logger.js';

/**
 * GetReturnsUseCase - Business logic for the admin returns listing.
 * Mirrors GetOrdersUseCase: repository handles search/filter/pagination,
 * the use case maps rows to the API shape.
 */
class GetReturnsUseCase {
    constructor(returnsRepository) {
        this.returnsRepository = returnsRepository;
    }

    async execute(filters) {
        try {
            const { rows, total } = await this.returnsRepository.findAllAdmin(filters);
            const totalPages = Math.ceil(total / filters.limit);

            return {
                returns: rows.map(toReturn),
                pagination: {
                    page: filters.page,
                    limit: filters.limit,
                    totalReturns: total,
                    totalPages,
                    hasNextPage: filters.page < totalPages,
                    hasPreviousPage: filters.page > 1,
                },
            };
        } catch (error) {
            logger.error('[GET_RETURNS_ERROR]', { errorMessage: error.message });
            throw error;
        }
    }
}

export default GetReturnsUseCase;
