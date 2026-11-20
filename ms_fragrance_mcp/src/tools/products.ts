import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client/backend.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookup } from 'node:dns/promises';

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
  const verifyResponse: any = await client.getProductById(productId);
  const verifyProduct = verifyResponse?.data ?? verifyResponse;
  if (verifyProduct?.imageUrl !== permanentImageUrl && verifyProduct?.image_url !== permanentImageUrl) {
    throw new Error('Product image URL was not saved correctly');
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ productId, imageUrl: permanentImageUrl, success: true, message: 'Product image uploaded and saved successfully.' }, null, 2),
      },
    ],
  };
}

function detectImageMime(buffer: Buffer): string {
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return 'image/webp';
  return '';
}

function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === '::1' || v === '0:0:0:0:0:0:0:1') return true;
  if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true;
  // IPv4-mapped IPv6
  const mapped = v.match(/^::ffff:(.+)$/);
  const target = mapped ? mapped[1] : v;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(target)) {
    const parts = target.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 0) return true;
  }
  if (target === '169.254.169.254') return true;
  return false;
}

async function resolveAndCheckHost(hostname: string): Promise<void> {
  if (isBlockedHost(hostname)) throw new Error('Blocked host');
  const records = await lookup(hostname, { all: true });
  for (const r of records) {
    if (isPrivateIp(r.address)) throw new Error('Resolved to private/internal IP');
  }
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0' || h === '169.254.169.254' || h === 'metadata.google.internal') return true;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|127\.)/.test(h)) return true;
  return false;
}

async function downloadImageFromUrl(imageUrl: string): Promise<{ buffer: Buffer; mime: string }> {
  let current = new URL(imageUrl);
  if (current.username || current.password) throw new Error('URL must not contain credentials');

  for (let redirectCount = 0; redirectCount < 5; redirectCount++) {
    await resolveAndCheckHost(current.hostname);
    if (current.protocol !== 'http:' && current.protocol !== 'https:') throw new Error('Unsupported URL protocol');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    let response: Response;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    try {
      response = await fetch(current.toString(), { redirect: 'manual', signal: controller.signal });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error('Redirect without location');
        const next = new URL(location, current);
        if (next.username || next.password) throw new Error('Redirect URL must not contain credentials');
        await resolveAndCheckHost(next.hostname);
        current = next;
        continue;
      }
      if (!response.ok) throw new Error(`Failed to download image: HTTP ${response.status}`);

      const contentLength = response.headers.get('content-length');
      if (contentLength && Number(contentLength) > 5 * 1024 * 1024) throw new Error('Image size exceeds 5 MB limit');

      reader = response.body?.getReader() ?? null;
      if (!reader) throw new Error('No response body');
      const chunks: Uint8Array[] = [];
      let total = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.length;
          if (total > 5 * 1024 * 1024) throw new Error('Image size exceeds 5 MB limit');
          chunks.push(value);
        }
      } finally {
        try { await reader.cancel(); } catch {}
      }
      const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      const mime = detectImageMime(buffer);
      if (!mime) throw new Error('Unsupported or invalid image format');
      return { buffer, mime };
    } catch (error) {
      if (reader) { try { await reader.cancel(); } catch {} }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw new Error('Too many redirects');
}

async function handleImageUrlUpload(imageUrl: string, productId: number, client: BackendClient) {
  const { buffer, mime } = await downloadImageFromUrl(imageUrl);
  const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'webp';
  const blob = new Blob([new Uint8Array(buffer)], { type: mime });
  const formData = new FormData();
  formData.append('image', blob, `product-${productId}.${ext}`);
  formData.append('productId', String(productId));

  const uploadResponse: any = await client.request('POST', '/api/products/upload-image', { body: formData });
  const data = uploadResponse?.data ?? uploadResponse;
  const permanentImageUrl = data?.imageUrl ?? data?.url ?? data?.image_url;
  if (!permanentImageUrl || typeof permanentImageUrl !== 'string') throw new Error('Image upload did not return a valid URL.');

  await client.request('PUT', `/api/products/${productId}`, { body: { imageUrl: permanentImageUrl } });
  const productResponse: any = await client.getProductById(productId);
  const product = productResponse?.data ?? productResponse;
  if (product?.imageUrl !== permanentImageUrl && product?.image_url !== permanentImageUrl) {
    throw new Error('Product image URL was not saved correctly');
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ productId, imageUrl: permanentImageUrl, success: true, message: 'Product image uploaded and saved successfully.' }, null, 2) }],
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
    'Generate or receive a product image, then upload it to Supabase Storage and update the product with the permanent public URL. Accepts either imageData (Base64/data URL) or imageUrl (HTTP/HTTPS). Downloads imageUrl if provided, validates format/size, uploads via multipart, updates product.image_url, and verifies the saved URL.',
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
        .optional()
        .describe('Base64 image data or a Base64 data URL generated by ChatGPT'),
      imageUrl: z
        .string()
        .url()
        .optional()
        .describe('HTTP/HTTPS URL of a generated image to download and upload'),
    },
    async (args) => {
      try {
        const { productId, imageData, imageUrl } = args;

        if (!productId || typeof productId !== 'number' || !Number.isInteger(productId) || productId < 1) {
          return {
            content: [{ type: 'text' as const, text: 'Error: Invalid productId. Must be a positive integer.' }],
            isError: true,
          };
        }

        const hasData = typeof imageData === 'string' && imageData.trim().length > 0;
        const hasUrl = typeof imageUrl === 'string' && imageUrl.trim().length > 0;
        if (hasData === hasUrl) {
          return {
            content: [{ type: 'text' as const, text: 'Error: Provide exactly one of imageData or imageUrl.' }],
            isError: true,
          };
        }

        if (hasData) {
          return await handleChatGPTImageDirect(imageData as string, productId, client);
        }
        return await handleImageUrlUpload(imageUrl as string, productId, client);
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
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
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
