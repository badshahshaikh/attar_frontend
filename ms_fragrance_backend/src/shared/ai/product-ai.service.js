class ProductAiService {
    constructor({ client }) {
        this.client = client;
    }

    async generateProductData(name) {
        const response = await this.client.responses.create({
            model: 'gpt-5.5',

            instructions: `
You are an expert perfume and attar product content assistant.

Generate professional ecommerce product information.

Rules:
- Use the provided product name as the basis.
- Write concise, premium product descriptions.
- Do not invent certifications or manufacturer claims.
- Do not claim specific ingredients unless reasonably known.
- If information is uncertain, return an empty string or empty array.
- Return only the requested structured data.
      `,

            input: `Generate product information for:

${name}`,

            text: {
                format: {
                    type: 'json_schema',
                    name: 'product_data',
                    strict: true,
                    schema: {
                        type: 'object',
                        properties: {
                            name: {
                                type: 'string'
                            },
                            description: {
                                type: 'string'
                            },
                            fragranceFamily: {
                                type: 'string'
                            },
                            fragranceType: {
                                type: 'string'
                            },
                            notes: {
                                type: 'array',
                                items: {
                                    type: 'string'
                                }
                            },
                            brand: {
                                type: 'string'
                            }
                        },
                        required: [
                            'name',
                            'description',
                            'fragranceFamily',
                            'fragranceType',
                            'notes',
                            'brand'
                        ],
                        additionalProperties: false
                    }
                }
            }
        });

        return JSON.parse(response.output_text);
    }
}

export default ProductAiService;