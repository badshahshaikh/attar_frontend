class AiGenerateProductImageUseCase {
    constructor(productAiService) {
        this.productAiService = productAiService;
    }

    async execute(productData) {
        return await this.productAiService.generateProductImage(productData);
    }
}

export default AiGenerateProductImageUseCase;