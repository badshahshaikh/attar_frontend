const NotFoundError = require('../../../../core/errors/NotFoundError');
const { logger } = require('../../../../shared/logging/logger');

class DeleteCategoryUseCase {
    constructor(catalogRepository) {
        this.catalogRepository = catalogRepository;
    }

    async execute(id) {
        try {
            const deleted = await this.catalogRepository.deleteCategory(id);
            
            if (!deleted) {
                throw new NotFoundError(`Category with ID ${id} not found`);
            }

            logger.info('[DELETE_CATEGORY]', { categoryId: id });
            
            return deleted;
        } catch (error) {
            logger.error('[DELETE_CATEGORY_ERROR]', { categoryId: id, errorMessage: error.message });
            throw error;
        }
    }
}

module.exports = DeleteCategoryUseCase;
