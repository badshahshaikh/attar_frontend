import { logger } from '../../../../shared/logging/logger.js';

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

export default GetBrandsUseCase;
