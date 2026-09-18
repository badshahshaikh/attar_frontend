const { logger } = require('../../../../shared/logging/logger');

class GetCategoriesUseCase {
    constructor(catalogRepository) {
        this.catalogRepository = catalogRepository;
    }

    async execute() {
        try {
            const categories = await this.catalogRepository.getAllCategories();
            return categories;
        } catch (error) {
            logger.error('[GET_CATEGORIES_ERROR]', { errorMessage: error.message });
            throw error;
        }
    }
}

module.exports = GetCategoriesUseCase;
