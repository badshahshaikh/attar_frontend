import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client/backend.js';

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
              type: 'text',
              text: JSON.stringify({ products, total, page: args.page, limit: args.limit }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
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
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
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
              type: 'text',
              text: JSON.stringify({ product: data, message: 'Product created successfully' }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
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
              type: 'text',
              text: JSON.stringify({ product: data, message: 'Product updated successfully' }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
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
              type: 'text',
              text: JSON.stringify({ product: data, message: 'Product activated successfully' }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error activating product: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
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
              type: 'text',
              text: JSON.stringify({ product: data, message: 'Product deactivated successfully' }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error deactivating product: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}