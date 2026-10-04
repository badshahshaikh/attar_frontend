class ProductAiService {
    constructor({ client }) {
        this.client = client;
    }

    async generateProductData(name) {
        const response = await this.client.responses.create({
            model: 'gpt-5.5',

            instructions: `
You are an expert perfume and attar ecommerce content assistant.

Generate product information that can be directly reviewed and inserted into an ecommerce product form.

Rules:
- Use the provided product name as the primary source.
- Generate concise, premium, natural ecommerce copy.
- Generate both a short description and a detailed full description.
- Identify fragrance family and fragrance type when reasonably known.
- Separate fragrance notes into top, heart, and base notes.
- Only provide a brand when it can be confidently identified from the product name.
- Only provide a category when reasonably known.
- Never invent prices, discounts, stock, ratings, reviews, or business status.
- Never invent certifications, manufacturer claims, ingredients, or unsupported facts.
- If information is uncertain, return an empty string.
- Do not generate fields that are not requested.
- Return only the structured JSON data.
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

                            fullDescription: {
                                type: 'string'
                            },

                            brand: {
                                type: 'string'
                            },

                            category: {
                                type: 'string'
                            },

                            fragranceFamily: {
                                type: 'string'
                            },

                            fragranceType: {
                                type: 'string'
                            },

                            topNotes: {
                                type: 'string'
                            },

                            heartNotes: {
                                type: 'string'
                            },

                            baseNotes: {
                                type: 'string'
                            }
                        },

                        required: [
                            'name',
                            'description',
                            'fullDescription',
                            'brand',
                            'category',
                            'fragranceFamily',
                            'fragranceType',
                            'topNotes',
                            'heartNotes',
                            'baseNotes'
                        ],

                        additionalProperties: false
                    }
                }
            }
        });

        return JSON.parse(response.output_text);
    }

    buildProductImagePrompt({
        name,
        description,
        fragranceFamily,
        topNotes,
        heartNotes,
        baseNotes
    }) {
        return `
Create a single premium ecommerce product photograph for this attar/perfume:

Product name: ${name}
Description: ${description}
Fragrance family: ${fragranceFamily}
Top notes: ${topNotes}
Heart notes: ${heartNotes}
Base notes: ${baseNotes}

Requirements:

- Create ONE product image only.
- Luxury attar product photography.
- Elegant premium glass attar bottle.
- Premium Middle Eastern fragrance aesthetic.
- Sophisticated studio lighting.
- Clean, minimal luxury background.
- Product centered and clearly visible.
- Photorealistic.
- No people.
- No unrelated objects.
- Front-facing ecommerce hero shot.
- Show the product name "${name}" clearly on the bottle.
- The bottle label must contain ONLY the product name.
- Do NOT display "MS Fragrance".
- Do NOT display any brand logo.
- Do NOT display any brand name.
- Do NOT add slogans, descriptions, ingredients, certifications, prices, or decorative text.
- Do NOT invent additional text.
- Keep the product name simple, elegant, and professionally printed.
- Make the text look physically printed on the bottle or label.
- Use a realistic premium bottle design suitable for an attar product.
- Keep the composition clean and suitable for an ecommerce product listing.
`;
    }

    async generatePng(prompt) {
        const result = await this.client.images.generate({
            model: 'gpt-image-2',
            prompt,
            size: '1024x1024'
        });

        return result.data[0].b64_json;
    }

    async generateProductImage(productData) {
        const prompt = this.buildProductImagePrompt(productData);

        return await this.generatePng(`
            ${prompt}

            Camera:
            Primary front-facing ecommerce hero shot.
            Show the complete bottle clearly.
            Keep the bottle centered with enough clean space around it.
        `);
    }
}

export default ProductAiService;