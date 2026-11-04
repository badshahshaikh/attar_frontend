import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client/backend.js';

export function registerOrderTools(server: McpServer, client: BackendClient) {
  // get_latest_orders
  server.tool(
    'get_latest_orders',
    'Retrieve the most recent orders from the MS Fragrance store. Returns order details including order number, customer info, status, payment status, and totals.',
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(10)
        .describe('Maximum number of orders to return (default: 10, max: 100)'),
      status: z
        .string()
        .optional()
        .describe('Filter by order status: placed, confirmed, packed, shipped, delivered, cancelled'),
      paymentStatus: z
        .string()
        .optional()
        .describe('Filter by payment status: unpaid, paid'),
    },
    async (args) => {
      try {
        const { data } = await client.getOrders({
          page: 1,
          limit: args.limit,
          status: args.status,
          paymentStatus: args.paymentStatus,
        });

        const orders = (data as { orders?: unknown[] }).orders || [];
        const pagination = (data as { pagination?: unknown }).pagination;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ orders, pagination }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching latest orders: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // get_order_details
  server.tool(
    'get_order_details',
    'Retrieve detailed information about a specific order by its ID. Returns full order details including items, shipping address, customer info, and status.',
    {
      orderId: z
        .number()
        .int()
        .positive()
        .describe('The order ID to retrieve'),
    },
    async (args) => {
      try {
        const { data } = await client.getOrderById(args.orderId);

        const order = (data as { order?: unknown }).order;

        if (!order) {
          return {
            content: [
              {
                type: 'text',
                text: `Order with ID ${args.orderId} not found`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(order, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching order details: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // search_orders
  server.tool(
    'search_orders',
    'Search orders using supported filters. Returns matching orders with pagination information.',
    {
      search: z
        .string()
        .optional()
        .describe('Search term (order number, customer name, email, or phone)'),
      status: z
        .string()
        .optional()
        .describe('Filter by order status: placed, confirmed, packed, shipped, delivered, cancelled'),
      paymentStatus: z
        .string()
        .optional()
        .describe('Filter by payment status: unpaid, paid'),
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
        .default(10)
        .describe('Maximum results per page (default: 10, max: 100)'),
    },
    async (args) => {
      try {
        const { data } = await client.getOrders({
          page: args.page,
          limit: args.limit,
          search: args.search,
          status: args.status,
          paymentStatus: args.paymentStatus,
        });

        const orders = (data as { orders?: unknown[] }).orders || [];
        const pagination = (data as { pagination?: unknown }).pagination;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ orders, pagination }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error searching orders: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}