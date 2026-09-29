import { logger } from '../../../../shared/logging/logger.js';

class AiFillProductUseCase {
    constructor(productAiService) {
        this.productAiService = productAiService;
    }

    async execute({ name }) {
        try {
            return await this.productAiService.generateProductData(name);
        } catch (error) {
            logger.error('[AI_FILL_PRODUCT_ERROR]', {
                productName: name,
                errorMessage: error.message
            });

            throw error;
        }
    }
}

export default AiFillProductUseCase;