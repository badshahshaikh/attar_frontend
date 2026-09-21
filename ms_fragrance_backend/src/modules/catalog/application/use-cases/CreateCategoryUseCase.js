import ValidationError from '../../../../core/errors/ValidationError.js';
import { logger } from '../../../../shared/logging/logger.js';

class CreateCategoryUseCase {
    constructor(catalogRepository) {
        this.catalogRepository = catalogRepository;
    }

    async execute(name) {
        try {
            if (!name || !String(name).trim()) {
                throw new ValidationError('Category name is required');
            }

            const category = await this.catalogRepository.createCategory(name);
            logger.info('[CREATE_CATEGORY]', { categoryId: category.id, categoryName: category.name });
            
            return category;
        } catch (error) {
            logger.error('[CREATE_CATEGORY_ERROR]', { errorMessage: error.message });
            throw error;
        }
    }
}

export default CreateCategoryUseCase;
