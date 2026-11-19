import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client/backend.js';
import fs from 'node:fs';
import path from 'node:path';

async function handleChatGPTImageDirect(imageData: string, productId: number, client: BackendClient) {
  // Validate and parse image data
  const trimmed = imageData.trim();
  if (!trimmed) throw new Error('imageData is empty');

  let base64 = trimmed;
  let mime = '';

  const dataUrlMatch = trimmed.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
  if (dataUrlMatch) {
    mime = dataUrlMatch[1].toLowerCase();
    base64 = dataUrlMatch[2];
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    throw new Error('Invalid Base64 image data');
  }

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) throw new Error('Invalid Base64 image data');
  if (buffer.length > 5 * 1024 * 1024) throw new Error('Image size exceeds 5 MB limit');

  // Detect format from magic bytes if not provided
  if (!mime) {
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) mime = 'image/png';
    else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) mime = 'image/jpeg';
    else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) mime = 'image/webp';
    else throw new Error('Unsupported image format. Only PNG, JPEG, and WebP are allowed.');
  }

  mime = mime === 'image/jpg' ? 'image/jpeg' : mime;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) {
    throw new Error('Unsupported image format. Only PNG, JPEG, and WebP are allowed.');
  }

  const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'webp';

  // Build FormData
  const blob = new Blob([new Uint8Array(buffer)], { type: mime });
  const formData = new FormData();
  formData.append('image', blob, `product-${productId}.${ext}`);
  formData.append('productId', String(productId));

  // Upload
  const uploadResponse: any = await client.request('POST', '/api/products/upload-image', { body: formData });
  const data = uploadResponse?.data ?? uploadResponse;
  const permanentImageUrl = data?.imageUrl ?? data?.url ?? data?.image_url;
  if (!permanentImageUrl || typeof permanentImageUrl !== 'string') {
    throw new Error('Image upload did not return a valid URL.');
  }
  try {
    const u = new URL(permanentImageUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('invalid');
  } catch {
    throw new Error('Image upload did not return a valid URL.');
  }

  // Update product
  await client.request('PUT', `/api/products/${productId}`, { body: { imageUrl: permanentImageUrl } });

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ productId, imageUrl: permanentImageUrl, success: true, message: 'Product image uploaded and saved successfully.' }, null, 2),
      },
    ],
  };
}

export function registerProductTools(server: McpServer, client: BackendClient) {
  // list_products
  server.tool(
    'list_products',
    'List and filter products from the MS Fragrance store. Returns product details including name, brand, category, price, stock status, and more.',
    {
      page: z
        .number()
        .int()
        .min(1)
        .default(1)
        .describe('Page number (default: 1)'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe('Maximum results per page (default: 20, max: 100)'),
      search: z
        .string()
        .optional()
        .describe('Search term for product name or description'),
      categories: z
        .array(z.string())
        .optional()
        .describe('Filter by fragrance families (e.g., Attar, Oud, Floral)'),
      brands: z
        .array(z.string())
        .optional()
        .describe('Filter by brand names'),
      minPrice: z
        .number()
        .min(0)
        .optional()
        .describe('Minimum price filter'),
      maxPrice: z
        .number()
        .min(0)
        .optional()
        .describe('Maximum price filter'),
      inStockOnly: z
        .boolean()
        .optional()
        .describe('Only show in-stock products'),
    },
    async (args) => {
      try {
        const { data } = await client.getProducts({
          page: args.page,
          limit: args.limit,
          search: args.search,
          categories: args.categories,
          brands: args.brands,
          minPrice: args.minPrice,
          maxPrice: args.maxPrice,
          inStockOnly: args.inStockOnly,
        });

        // Handle both array and object responses
        let products: unknown[] = [];
        let total = 0;

        if (Array.isArray(data)) {
          products = data;
          total = data.length;
        } else {
          products = (data as { products?: unknown[] }).products || [];
          total = (data as { total?: number }).total || products.length;
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ products, total, page: args.page, limit: args.limit }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error listing products: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // get_product_by_id
  server.tool(
    'get_product_by_id',
    'Retrieve detailed information about a specific product by its ID. Returns full product details including name, brand, category, price, stock, notes, and images.',
    {
      productId: z
        .number()
        .int()
        .positive()
        .describe('The product ID to retrieve'),
    },
    async (args) => {
      try {
        const { data } = await client.getProductById(args.productId);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error fetching product: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // create_product
  server.tool(
    'create_product',
    'Create a new product in the MS Fragrance store. Returns the created product with its assigned ID and slug.',
    {
      name: z.string().min(1).describe('Product name (required)'),
      brand: z.string().min(1).describe('Brand name (required)'),
      fragranceFamily: z.string().min(1).describe('Fragrance family/category (required)'),
      price: z.number().min(0).describe('Product price (required, must be non-negative)'),
      category: z.string().optional().describe('Product category'),
      description: z.string().optional().describe('Short product description'),
      fullDescription: z.string().optional().describe('Full product description'),
      sizePricing: z.record(z.string(), z.number()).optional().describe('Size-based pricing map, e.g. { "3ml": 99, "6ml": 149 }'),
      sizes: z.array(z.string()).optional().describe('Available sizes'),
      topNotes: z.array(z.string()).optional().describe('Top fragrance notes'),
      heartNotes: z.array(z.string()).optional().describe('Heart fragrance notes'),
      baseNotes: z.array(z.string()).optional().describe('Base fragrance notes'),
      longevity: z.string().optional().describe('Longevity rating'),
      inStock: z.boolean().optional().describe('Whether the product is in stock'),
      isNew: z.boolean().optional().describe('Whether the product is marked as new'),
      isBestSeller: z.boolean().optional().describe('Whether the product is a best seller'),
      isExclusive: z.boolean().optional().describe('Whether the product is exclusive'),
      featured: z.boolean().optional().describe('Whether the product is featured'),
      stockQuantity: z.number().int().min(0).optional().describe('Stock quantity'),
      originalPrice: z.number().min(0).optional().describe('Original price before discount'),
      rating: z.number().min(0).max(5).optional().describe('Product rating (0-5)'),
      reviews: z.number().int().min(0).optional().describe('Number of reviews'),
      slug: z.string().optional().describe('URL slug (auto-generated from name if not provided)'),
      imageUrl: z.string().optional().describe('Primary image URL'),
      imageUrls: z.array(z.string()).optional().describe('Array of image URLs'),
    },
    async (args) => {
      try {
        const { data } = await client.createProduct({
          name: args.name,
          brand: args.brand,
          fragranceFamily: args.fragranceFamily,
          price: args.price,
          category: args.category,
          description: args.description,
          fullDescription: args.fullDescription,
          sizePricing: args.sizePricing,
          sizes: args.sizes,
          topNotes: args.topNotes,
          heartNotes: args.heartNotes,
          baseNotes: args.baseNotes,
          longevity: args.longevity,
          inStock: args.inStock,
          isNew: args.isNew,
          isBestSeller: args.isBestSeller,
          isExclusive: args.isExclusive,
          featured: args.featured,
          stockQuantity: args.stockQuantity,
          originalPrice: args.originalPrice,
          rating: args.rating,
          reviews: args.reviews,
          slug: args.slug,
          imageUrl: args.imageUrl,
          imageUrls: args.imageUrls,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ product: data, message: 'Product created successfully' }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error creating product: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // update_product
  server.tool(
    'update_product',
    'Update an existing product by ID. Only supplied fields are updated; unrelated fields are preserved.',
    {
      productId: z.number().int().positive().describe('The product ID to update (required)'),
      name: z.string().min(1).optional().describe('Product name'),
      brand: z.string().min(1).optional().describe('Brand name'),
      fragranceFamily: z.string().min(1).optional().describe('Fragrance family/category'),
      price: z.number().min(0).optional().describe('Product price (must be non-negative)'),
      category: z.string().optional().describe('Product category'),
      description: z.string().optional().describe('Short product description'),
      fullDescription: z.string().optional().describe('Full product description'),
      sizePricing: z.record(z.string(), z.number()).optional().describe('Size-based pricing map'),
      sizes: z.array(z.string()).optional().describe('Available sizes'),
      topNotes: z.array(z.string()).optional().describe('Top fragrance notes'),
      heartNotes: z.array(z.string()).optional().describe('Heart fragrance notes'),
      baseNotes: z.array(z.string()).optional().describe('Base fragrance notes'),
      longevity: z.string().optional().describe('Longevity rating'),
      inStock: z.boolean().optional().describe('Whether the product is in stock'),
      isNew: z.boolean().optional().describe('Whether the product is marked as new'),
      isBestSeller: z.boolean().optional().describe('Whether the product is a best seller'),
      isExclusive: z.boolean().optional().describe('Whether the product is exclusive'),
      featured: z.boolean().optional().describe('Whether the product is featured'),
      stockQuantity: z.number().int().min(0).optional().describe('Stock quantity'),
      originalPrice: z.number().min(0).optional().describe('Original price before discount'),
      rating: z.number().min(0).max(5).optional().describe('Product rating (0-5)'),
      reviews: z.number().int().min(0).optional().describe('Number of reviews'),
      slug: z.string().optional().describe('URL slug'),
      imageUrl: z.string().optional().describe('Primary image URL'),
      imageUrls: z.array(z.string()).optional().describe('Array of image URLs'),
    },
    async (args) => {
      try {
        const { productId, ...updateData } = args;
        const { data } = await client.updateProduct(productId, updateData);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ product: data, message: 'Product updated successfully' }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error updating product: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // activate_product
  server.tool(
    'activate_product',
    'Activate an inactive product by setting its in-stock status to true. The product must already exist.',
    {
      productId: z.number().int().positive().describe('The product ID to activate (required)'),
    },
    async (args) => {
      try {
        const { data } = await client.activateProduct(args.productId);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ product: data, message: 'Product activated successfully' }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error activating product: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // generate_and_save_product_image
  server.tool(
    'generate_and_save_product_image',
    'Generate a product image using AI, upload it to Supabase Storage, and update the product with the permanent public URL. Only the image URL is persisted; other product fields are unchanged.',
    {
      productId: z
        .number()
        .int()
        .positive()
        .describe('The product ID to update with the generated image'),
      name: z
        .string()
        .optional()
        .describe('Product name used as context for AI image generation. If omitted, the existing product name is used.'),
      imageData: z
        .string()
        .min(1)
        .describe('Base64 image data or a Base64 data URL generated by ChatGPT'),
    },
    async (args) => {
      try {
        const { productId, imageData } = args;

        if (!productId || typeof productId !== 'number' || !Number.isInteger(productId) || productId < 1) {
          return {
            content: [{ type: 'text' as const, text: 'Error: Invalid productId. Must be a positive integer.' }],
            isError: true,
          };
        }

        return await handleChatGPTImageDirect(imageData, productId, client);
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // get_product_image_reference
  server.tool(
    'get_product_image_reference',
    'Return the existing MS Fragrance product image prompt/style instructions and the master bottle reference image as MCP image content.',
    {},
    async () => {
      const masterPath = path.resolve(__dirname, '../../../ms_fragrance_backend/src/assets/ms-fragrance-master.png');
      const imageBuffer = fs.readFileSync(masterPath);
      const base64 = imageBuffer.toString('base64');
      const prompt = `Use the supplied reference image of the MS Fragrance bottle as the exact bottle identity for this shot. Reproduce that same bottle; do not redesign it.

PRODUCT
- Product name: {name}
- Description: {description}
- Fragrance family: {fragranceFamily}
- Top notes: {topNotes}
- Heart notes: {heartNotes}
- Base notes: {baseNotes}

BOTTLE IDENTITY — KEEP EXACTLY AS IN THE REFERENCE IMAGE
- Preserve the bottle's silhouette, proportions and front-facing camera angle.
- Preserve the amber-brown glass, the glossy black cap, the neck and the clear glass base.
- Preserve the ivory rectangular label, its thin border and ornamental details.
- Preserve the "MS FRAGRANCE" brand name and the Arabic text "سعد للعطورات" exactly.
- The only text that changes is the product-name area: print "{name}" there.
- Do NOT remove the MS FRAGRANCE brand or the Arabic text.
- Do NOT invent extra label text, logos, certifications, prices or claims.
- Do NOT redesign the bottle to match the background.

BACKGROUND — INSPIRED BY THIS PRODUCT'S SCENT PROFILE
- Create a premium, photorealistic ecommerce background inspired by the product name, description, fragrance family and the top, heart and base notes above.
- Use appropriate fragrance-related materials or atmosphere when relevant, such as woods, amber, florals, spices, citrus, musk-inspired tones or smoke.
- Make the background specific to this fragrance — do not reuse a generic look.
- Keep background props behind or around the bottle; they must never obscure the label.

COMPOSITION & QUALITY
- ONE product image only. No multiple bottles, collages, split screens or extra text.
- Keep the entire bottle visible and centered with a consistent, professional composition.
- Photorealistic luxury attar/perfume product photography with sophisticated studio lighting.
- No people. No food or ingredients inside the bottle.`;

      return {
        content: [
          { type: 'text' as const, text: prompt },
          { type: 'image' as const, data: base64, mimeType: 'image/png' },
        ],
      };
    }
  );

  // deactivate_product
  server.tool(
    'deactivate_product',
    'Deactivate an active product by setting its in-stock status to false. The product must already exist.',
    {
      productId: z.number().int().positive().describe('The product ID to deactivate (required)'),
    },
    async (args) => {
      try {
        const { data } = await client.deactivateProduct(args.productId);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ product: data, message: 'Product deactivated successfully' }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error deactivating product: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
