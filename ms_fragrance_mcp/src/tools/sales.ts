import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client/backend.js';

export function registerSalesTools(server: McpServer, client: BackendClient) {
  // get_sales_summary
  server.tool(
    'get_sales_summary',
    'Calculate a sales summary from order data within a date range. Returns total orders, total revenue, orders by status, and payment status breakdown.',
    {
      startDate: z
        .string()
        .describe('Start date (ISO format, e.g., 2024-01-01)'),
      endDate: z
        .string()
        .describe('End date (ISO format, e.g., 2024-12-31)'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .default(500)
        .describe('Maximum orders to analyze (default: 500, max: 1000)'),
    },
    async (args) => {
      try {
        // Validate dates
        const start = new Date(args.startDate);
        const end = new Date(args.endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return {
            content: [
              {
                type: 'text',
                text: 'Invalid date format. Use ISO format (e.g., 2024-01-01)',
              },
            ],
            isError: true,
          };
        }

        if (start > end) {
          return {
            content: [
              {
                type: 'text',
                text: 'Start date must be before end date',
              },
            ],
            isError: true,
          };
        }

        // Fetch orders within the date range
        const { data } = await client.getOrders({
          page: 1,
          limit: args.limit,
        });

        const allOrders = (data as { orders?: unknown[] }).orders || [];

        // Filter orders within date range
        const filteredOrders = allOrders.filter((order: any) => {
          const orderDate = new Date(order.orderDate as string);
          return orderDate >= start && orderDate <= end;
        });

        // Calculate summary
        const totalOrders = filteredOrders.length;
        const totalRevenue = filteredOrders.reduce(
          (sum: number, order: any) => sum + (Number(order.total) || 0),
          0
        );

        // Orders by status
        const ordersByStatus: Record<string, number> = {};
        filteredOrders.forEach((order: any) => {
          const status = (order.status as string) || 'unknown';
          ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
        });

        // Payment status breakdown
        const paymentStatusBreakdown: Record<string, number> = {};
        filteredOrders.forEach((order: any) => {
          const paymentStatus = (order.paymentStatus as string) || 'unknown';
          paymentStatusBreakdown[paymentStatus] = (paymentStatusBreakdown[paymentStatus] || 0) + 1;
        });

        // Revenue by status
        const revenueByStatus: Record<string, number> = {};
        filteredOrders.forEach((order: any) => {
          const status = (order.status as string) || 'unknown';
          revenueByStatus[status] = (revenueByStatus[status] || 0) + (Number(order.total) || 0);
        });

        const summary = {
          dateRange: {
            start: args.startDate,
            end: args.endDate,
          },
          totalOrders,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          averageOrderValue: totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
          ordersByStatus,
          paymentStatusBreakdown,
          revenueByStatus,
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error calculating sales summary: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}