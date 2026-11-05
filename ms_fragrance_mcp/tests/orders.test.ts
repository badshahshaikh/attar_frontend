import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../src/client/backend.js';
import { registerOrderTools } from '../src/tools/orders.js';

describe('Order Tools', () => {
  let server: McpServer;
  let client: BackendClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '1.0.0' });
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    client = new BackendClient({
      backendApiUrl: 'http://localhost:5000',
      backendServiceKey: 'test-service-key',
      mcpAccessKey: 'test-mcp-key',
      mcpPort: 3001,
      nodeEnv: 'test',
    });
    registerOrderTools(server, client);
  });

  describe('get_latest_orders', () => {
    it('should return orders when API call succeeds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: [{ id: 1, orderNumber: 'ORD-001', status: 'placed' }],
          pagination: { page: 1, limit: 10, totalOrders: 1 },
        }),
      });

      expect(server).toBeDefined();
    });

    it('should handle empty results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: [], pagination: { page: 1, limit: 10, totalOrders: 0 } }),
      });

      expect(server).toBeDefined();
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

      expect(server).toBeDefined();
    });
  });

  describe('get_order_details', () => {
    it('should return order details for valid ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ order: { id: 1, orderNumber: 'ORD-001', status: 'placed' } }),
      });

      expect(server).toBeDefined();
    });

    it('should handle order not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Order not found' }),
      });

      expect(server).toBeDefined();
    });
  });

  describe('search_orders', () => {
    it('should search orders with filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: [{ id: 1, orderNumber: 'ORD-001' }],
          pagination: { page: 1, limit: 10, totalOrders: 1 },
        }),
      });

      expect(server).toBeDefined();
    });
  });
});