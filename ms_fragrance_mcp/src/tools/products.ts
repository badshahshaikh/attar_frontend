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
}