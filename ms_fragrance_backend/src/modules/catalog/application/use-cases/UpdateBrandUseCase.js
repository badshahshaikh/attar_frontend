const ValidationError = require('../../../../core/errors/ValidationError');
const NotFoundError = require('../../../../core/errors/NotFoundError');
const { logger } = require('../../../../shared/logging/logger');

class UpdateBrandUseCase {
    constructor(catalogRepository) {
        this.catalogRepository = catalogRepository;
    }

    async execute(id, name) {
        try {
            if (!name || !String(name).trim()) {
                throw new ValidationError('Brand name is required');
            }

            const brand = await this.catalogRepository.updateBrand(id, name);
            
            if (!brand) {
                throw new NotFoundError(`Brand with ID ${id} not found`);
            }

            logger.info('[UPDATE_BRAND]', { brandId: id, brandName: name });
            
            return brand;
        } catch (error) {
            logger.error('[UPDATE_BRAND_ERROR]', { brandId: id, errorMessage: error.message });
            throw error;
        }
    }
}

module.exports = UpdateBrandUseCase;
