import { toReturnDetail } from '../../return.mapper.js';
import { logger } from '../../../../shared/logging/logger.js';

/**
 * GetReturnByIdUseCase - Business logic for one admin return (View action).
 * Returns the return with items, history timeline, refund and order snapshot,
 * or null when the return does not exist.
 */
class GetReturnByIdUseCase {
    constructor(returnsRepository) {
        this.returnsRepository = returnsRepository;
    }

    async execute(id) {
        try {
            const row = await this.returnsRepository.findByIdAdmin(id);
            return toReturnDetail(row);
        } catch (error) {
            logger.error('[GET_RETURN_BY_ID_ERROR]', { returnId: id, errorMessage: error.message });
            throw error;
        }
    }
}

export default GetReturnByIdUseCase;
