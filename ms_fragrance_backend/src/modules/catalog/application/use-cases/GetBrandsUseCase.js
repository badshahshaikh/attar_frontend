const { logger } = require('../../../../shared/logging/logger');

class GetBrandsUseCase {
    constructor(catalogRepository) {
        this.catalogRepository = catalogRepository;
    }

    async execute() {
        try {
            const brands = await this.catalogRepository.getAllBrands();
            return brands;
        } catch (error) {
            logger.error('[GET_BRANDS_ERROR]', { errorMessage: error.message });
            throw error;
        }
    }
}

module.exports = GetBrandsUseCase;
