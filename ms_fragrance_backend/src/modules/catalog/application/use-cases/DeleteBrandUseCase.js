const NotFoundError = require('../../../../core/errors/NotFoundError');
const { logger } = require('../../../../shared/logging/logger');

class DeleteBrandUseCase {
    constructor(catalogRepository) {
        this.catalogRepository = catalogRepository;
    }

    async execute(id) {
        try {
            const deleted = await this.catalogRepository.deleteBrand(id);
            
            if (!deleted) {
                throw new NotFoundError(`Brand with ID ${id} not found`);
            }

            logger.info('[DELETE_BRAND]', { brandId: id });
            
            return deleted;
        } catch (error) {
            logger.error('[DELETE_BRAND_ERROR]', { brandId: id, errorMessage: error.message });
            throw error;
        }
    }
}

module.exports = DeleteBrandUseCase;
