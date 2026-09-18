const ValidationError = require('../../../../core/errors/ValidationError');
const NotFoundError = require('../../../../core/errors/NotFoundError');
const { logger } = require('../../../../shared/logging/logger');

class UpdateCategoryUseCase {
    constructor(catalogRepository) {
        this.catalogRepository = catalogRepository;
    }

    async execute(id, name) {
        try {
            if (!name || !String(name).trim()) {
                throw new ValidationError('Category name is required');
            }

            const category = await this.catalogRepository.updateCategory(id, name);
            
            if (!category) {
                throw new NotFoundError(`Category with ID ${id} not found`);
            }

            logger.info('[UPDATE_CATEGORY]', { categoryId: id, categoryName: name });
            
            return category;
        } catch (error) {
            logger.error('[UPDATE_CATEGORY_ERROR]', { categoryId: id, errorMessage: error.message });
            throw error;
        }
    }
}

module.exports = UpdateCategoryUseCase;
