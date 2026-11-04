import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client/backend.js';

export function registerCustomerTools(server: McpServer, client: BackendClient) {
  // search_customers
  server.tool(
    'search_customers',
    'Search customers by name, email, or other criteria. Returns customer details including name, email, phone, registration date, and status.',
    {
      search: z
        .string()
        .optional()
        .describe('Search term (customer name or email)'),
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
        const { data } = await client.getUsers({
          page: args.page,
          limit: args.limit,
          search: args.search,
        });

        const customers = (data as { customers?: unknown[] }).customers || [];
        const pagination = (data as { pagination?: unknown }).pagination;

        // Sanitize: only return necessary fields (no passwords, tokens, etc.)
        const sanitizedCustomers = customers.map((c: any) => ({
          id: c.id,
          fullName: c.fullName,
          email: c.email,
          phone: c.phone,
          status: c.status,
          registeredAt: c.registeredAt,
          lastLoginAt: c.lastLoginAt,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ customers: sanitizedCustomers, pagination }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error searching customers: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // get_customer_details
  server.tool(
    'get_customer_details',
    'Retrieve detailed information about a specific customer by their ID. Returns customer profile including name, email, phone, registration date, and status.',
    {
      customerId: z
        .number()
        .int()
        .positive()
        .describe('The customer ID to retrieve'),
    },
    async (args) => {
      try {
        const { data } = await client.getUsers({
          page: 1,
          limit: 100,
          search: '',
        });

        const customers = (data as { customers?: unknown[] }).customers || [];
        const customer = customers.find((c: any) => c.id === args.customerId) as any;

        if (!customer) {
          return {
            content: [
              {
                type: 'text',
                text: `Customer with ID ${args.customerId} not found`,
              },
            ],
          };
        }

        // Sanitize: only return necessary fields
        const sanitizedCustomer = {
          id: customer.id,
          fullName: customer.fullName,
          email: customer.email,
          phone: customer.phone,
          status: customer.status,
          registeredAt: customer.registeredAt,
          lastLoginAt: customer.lastLoginAt,
        } as any;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(sanitizedCustomer, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching customer details: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}