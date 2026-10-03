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

    async generateProductImage({
        name,
        description,
        fragranceFamily,
        topNotes,
        heartNotes,
        baseNotes
    }) {
        const prompt = `
        Create a premium ecommerce product photograph for the attar/perfume:

        Product: ${name}
        Description: ${description}
        Fragrance family: ${fragranceFamily}
        Top notes: ${topNotes}
        Heart notes: ${heartNotes}
        Base notes: ${baseNotes}

        Requirements:
        - Luxury attar product photography
        - Elegant premium glass attar bottle
        - Premium Middle Eastern fragrance aesthetic
        - Sophisticated studio lighting
        - Clean, minimal luxury background
        - Product centered and clearly visible
        - Photorealistic
        - No people
        - Display the exact MS Fragrance brand logo 
        - Display the exact product name "${name}" clearly on the bottle
        - Keep the logo and product name simple, elegant, and professionally printed
        - Do not create, modify, redesign, or invent the MS Fragrance logo
        - Do not add any other brand names or unnecessary text
        - Bottle labeling should look realistic and physically printed on the bottle
        - Suitable for a premium ecommerce product listing
        `;
        const result = await this.client.images.generate({
            model: 'gpt-image-2',
            prompt,
            size: '1024x1024'
        });

        return result.data[0].b64_json;
    }
}

export default ProductAiService;