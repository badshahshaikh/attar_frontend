import { loadMasterProductImage } from './master-product-image.js';
import AppError from '../../core/errors/AppError.js';

// GPT image model used for reference-based generation. gpt-image-2 supports the
// images.edit reference operation used below.
const IMAGE_MODEL = 'gpt-image-2';

class ProductAiService {
    constructor({ client, loadMasterImage }) {
        this.client = client;
        // Injectable so tests can supply a stub; production uses the real loader.
        this.loadMasterImage = loadMasterImage || loadMasterProductImage;
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

    // Build the image-edit prompt. The master bottle reference image is passed
    // to the API separately (see generateProductImage); this prompt tells the
    // model to keep that bottle identical and only vary the product name and a
    // fragrance-inspired background.
    buildProductImagePrompt({
        name,
        description,
        fragranceFamily,
        topNotes,
        heartNotes,
        baseNotes
    }) {
        return `
Use the supplied reference image of the MS Fragrance bottle as the exact bottle
identity for this shot. Reproduce that same bottle; do not redesign it.

PRODUCT
- Product name: ${name}
- Description: ${description}
- Fragrance family: ${fragranceFamily}
- Top notes: ${topNotes}
- Heart notes: ${heartNotes}
- Base notes: ${baseNotes}

BOTTLE IDENTITY — KEEP EXACTLY AS IN THE REFERENCE IMAGE
- Preserve the bottle's silhouette, proportions and front-facing camera angle.
- Preserve the amber-brown glass, the glossy black cap, the neck and the clear glass base.
- Preserve the ivory rectangular label, its thin border and ornamental details.
- Preserve the "MS FRAGRANCE" brand name and the Arabic text "سعد للعطورات" exactly.
- The only text that changes is the product-name area: print "${name}" there.
- Do NOT remove the MS FRAGRANCE brand or the Arabic text.
- Do NOT invent extra label text, logos, certifications, prices or claims.
- Do NOT redesign the bottle to match the background.

BACKGROUND — INSPIRED BY THIS PRODUCT'S SCENT PROFILE
- Create a premium, photorealistic ecommerce background inspired by the product
  name, description, fragrance family and the top, heart and base notes above.
- Use appropriate fragrance-related materials or atmosphere when relevant, such
  as woods, amber, florals, spices, citrus, musk-inspired tones or smoke.
- Make the background specific to this fragrance — do not reuse a generic look.
- Keep background props behind or around the bottle; they must never obscure the label.

COMPOSITION & QUALITY
- ONE product image only. No multiple bottles, collages, split screens or extra text.
- Keep the entire bottle visible and centered with a consistent, professional composition.
- Photorealistic luxury attar/perfume product photography with sophisticated studio lighting.
- No people. No food or ingredients inside the bottle.
`;
    }

    // Reference-based generation: the master bottle image is passed to the
    // images.edit endpoint as an actual image input (not just prompt text), so
    // every product reuses the same bottle. Returns the raw base64 PNG string,
    // matching the existing frontend contract (res.json({ image })).
    async generatePng(prompt, masterImageFile) {
        const result = await this.client.images.edit({
            model: IMAGE_MODEL,
            image: [masterImageFile],
            prompt,
            size: '1024x1024'
        });

        return result.data[0].b64_json;
    }

    async generateProductImage(productData) {
        const { name } = productData || {};

        // Validate required input before doing any work or hitting the API.
        if (!name || !String(name).trim()) {
            throw new AppError('Product name is required to generate an image.', 400, 'PRODUCT_NAME_REQUIRED');
        }

        const prompt = this.buildProductImagePrompt(productData);

        // Load the single master bottle reference. Throws a safe AppError (503)
        // if the asset is missing — never exposes the filesystem path.
        const { file: masterImageFile } = await this.loadMasterImage();

        return await this.generatePng(prompt, masterImageFile);
    }
}

export default ProductAiService;