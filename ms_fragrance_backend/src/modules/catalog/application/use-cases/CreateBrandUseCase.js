import ValidationError from '../../../../core/errors/ValidationError.js';
import { logger } from '../../../../shared/logging/logger.js';

class CreateBrandUseCase {
    constructor(catalogRepository) {
        this.catalogRepository = catalogRepository;
    }

    async execute(name) {
        try {
            if (!name || !String(name).trim()) {
                throw new ValidationError('Brand name is required');
            }

            const brand = await this.catalogRepository.createBrand(name);
            logger.info('[CREATE_BRAND]', { brandId: brand.id, brandName: brand.name });
            
            return brand;
        } catch (error) {
            logger.error('[CREATE_BRAND_ERROR]', { errorMessage: error.message });
            throw error;
        }
    }
}

export default CreateBrandUseCase;
