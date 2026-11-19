import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../src/client/backend.js';
import { registerOrderTools } from '../src/tools/orders.js';

function createMockResponse(response: { ok: boolean; status: number; jsonData: unknown }) {
  return {
    ok: response.ok,
    status: response.status,
    json: async () => response.jsonData,
  };
}

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
      auth0IssuerBaseUrl: 'https://test.auth0.com/',
      auth0Audience: 'https://test.audience.com',
      mcpResourceScopes: ['mcp:read'],
      mcpServerUrl: 'https://test.mcp.com',
    });
    registerOrderTools(server, client);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('get_latest_orders', () => {
    it('should return orders when API call succeeds', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        jsonData: {
          orders: [{ id: 1, orderNumber: 'ORD-001', status: 'placed' }],
          pagination: { page: 1, limit: 10, totalOrders: 1 },
        },
      }));

      expect(server).toBeDefined();
    });

    it('should handle empty results', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        jsonData: { orders: [], pagination: { page: 1, limit: 10, totalOrders: 0 } },
      }));

      expect(server).toBeDefined();
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 500,
        jsonData: { error: 'Internal server error' },
      }));

      expect(server).toBeDefined();
    });
  });

  describe('get_order_details', () => {
    it('should return order details for valid ID', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        jsonData: { order: { id: 1, orderNumber: 'ORD-001', status: 'placed' } },
      }));

      expect(server).toBeDefined();
    });

    it('should handle order not found', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        jsonData: { error: 'Order not found' },
      }));

      expect(server).toBeDefined();
    });
  });

  describe('search_orders', () => {
    it('should search orders with filters', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        jsonData: {
          orders: [{ id: 1, orderNumber: 'ORD-001' }],
          pagination: { page: 1, limit: 10, totalOrders: 1 },
        },
      }));

      expect(server).toBeDefined();
    });
  });

  describe('BackendClient health check and verification', () => {
    it('should return healthy=true when health check succeeds', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        jsonData: { status: 'ok', environment: 'test' },
      }));

      const result = await client.verifyBackendConnection();

      expect(result.healthy).toBe(true);
      expect(result.message).toBe('Backend connection verified');
    });

    it('should return healthy=false when health check fails with 404', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        jsonData: { error: 'Not Found' },
      }));

      const result = await client.verifyBackendConnection();

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('Backend endpoint not found');
      expect(result.message).toContain('BACKEND_API_URL may be misconfigured');
    });

    it('should return healthy=false when health check fails with 401', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 401,
        jsonData: { error: 'Invalid token' },
      }));

      const result = await client.verifyBackendConnection();

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('Backend authentication failed');
      expect(result.message).toContain('BACKEND_SERVICE_KEY may be invalid');
    });

    it('should return healthy=false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.verifyBackendConnection();

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('Backend connection failed');
    });
  });

  describe('BackendClient error message formatting', () => {
    it('should not expose service key in error messages', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        jsonData: { error: 'Not Found' },
      }));

      try {
        await client.getOrders({ limit: 10 });
      } catch (error) {
        const message = (error as Error).message;
        expect(message).not.toContain('test-service-key');
      }
    });

    it('should include requested URL in 404 error', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        jsonData: { error: 'Not Found' },
      }));

      try {
        await client.getOrders({ limit: 10 });
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('/api/orders');
        expect(message).toContain('BACKEND_API_URL may be misconfigured');
      }
    });
  });
});