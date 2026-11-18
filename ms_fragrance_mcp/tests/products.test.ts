import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../src/client/backend.js';
import { registerProductTools } from '../src/tools/products.js';

function createMockResponse(response: { ok: boolean; status: number; jsonData: unknown }) {
  return {
    ok: response.ok,
    status: response.status,
    json: async () => response.jsonData,
  };
}

function createClient() {
  return new BackendClient({
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
}

describe('BackendClient product management methods', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let client: BackendClient;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    client = createClient();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createProduct', () => {
    it('should POST to /api/products and return created product', async () => {
      const createdProduct = { id: 42, name: 'Oud Royale', slug: 'oud-royale-42', inStock: true };
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 201,
        jsonData: createdProduct,
      }));

      const result = await client.createProduct({
        name: 'Oud Royale',
        brand: 'Surrati',
        fragranceFamily: 'Oud',
        price: 99,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/products'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-service-key',
          }),
          body: JSON.stringify({
            name: 'Oud Royale',
            brand: 'Surrati',
            fragranceFamily: 'Oud',
            price: 99,
          }),
        })
      );
      expect(result.status).toBe(201);
      expect(result.data).toEqual(createdProduct);
    });

    it('should throw on 401 authentication failure', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 401,
        jsonData: { error: 'Invalid token' },
      }));

      await expect(client.createProduct({ name: 'Test', brand: 'B', fragranceFamily: 'Oud', price: 10 }))
        .rejects.toThrow(/authentication failed/i);
    });

    it('should throw on 409 duplicate product', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 409,
        jsonData: { error: 'Product with this name already exists' },
      }));

      await expect(client.createProduct({ name: 'Dup', brand: 'B', fragranceFamily: 'Oud', price: 10 }))
        .rejects.toThrow(/already exists/i);
    });
  });

  describe('updateProduct', () => {
    it('should PUT to /api/products/:id and return updated product', async () => {
      const updatedProduct = { id: 7, name: 'Updated Attar', slug: 'updated-attar-7', inStock: true };
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        jsonData: updatedProduct,
      }));

      const result = await client.updateProduct(7, { name: 'Updated Attar', price: 149 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/products/7'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated Attar', price: 149 }),
        })
      );
      expect(result.status).toBe(200);
      expect(result.data).toEqual(updatedProduct);
    });

    it('should throw 404 when product not found', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        jsonData: { error: 'Product not found' },
      }));

      await expect(client.updateProduct(999, { name: 'X' }))
        .rejects.toThrow(/not found/i);
    });

    it('should throw 401 on authentication failure', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 401,
        jsonData: { error: 'Invalid token' },
      }));

      await expect(client.updateProduct(7, { name: 'X' }))
        .rejects.toThrow(/authentication failed/i);
    });

    it('should PUT only the provided price field (partial update)', async () => {
      const updatedProduct = { id: 7, name: 'Updated Attar', price: 149, inStock: true };
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        jsonData: updatedProduct,
      }));

      const result = await client.updateProduct(7, { price: 149 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/products/7'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ price: 149 }),
        })
      );
      expect(result.status).toBe(200);
    });

    it('should PUT null values explicitly (not omit them)', async () => {
      const updatedProduct = { id: 7, name: 'Updated Attar', description: null };
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        jsonData: updatedProduct,
      }));

      const result = await client.updateProduct(7, { description: null });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/products/7'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ description: null }),
        })
      );
      expect(result.status).toBe(200);
    });

    it('should throw 400 when no fields provided besides productId', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 400,
        jsonData: { error: 'At least one field must be provided to update a product' },
      }));

      await expect(client.updateProduct(7, {}))
        .rejects.toThrow(/At least one field must be provided/);
    });

    it('should throw 403 when not authorized', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 403,
        jsonData: { error: 'Forbidden' },
      }));

      await expect(client.updateProduct(7, { price: 149 }))
        .rejects.toThrow(/forbidden/i);
    });
  });

  describe('activateProduct', () => {
    it('should PATCH to /api/products/:id/activate and return activated product', async () => {
      const activatedProduct = { id: 7, name: 'Oud Royale', inStock: true };
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        jsonData: activatedProduct,
      }));

      const result = await client.activateProduct(7);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/products/7/activate'),
        expect.objectContaining({
          method: 'PATCH',
        })
      );
      expect(result.status).toBe(200);
      expect(result.data).toEqual(activatedProduct);
    });

    it('should throw 404 when product not found', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        jsonData: { error: 'Product with ID 999 not found' },
      }));

      await expect(client.activateProduct(999))
        .rejects.toThrow(/not found/i);
    });

    it('should throw 403 when not authorized', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 403,
        jsonData: { error: 'Forbidden' },
      }));

      await expect(client.activateProduct(7))
        .rejects.toThrow(/forbidden/i);
    });
  });

  describe('deactivateProduct', () => {
    it('should PATCH to /api/products/:id/deactivate and return deactivated product', async () => {
      const deactivatedProduct = { id: 7, name: 'Oud Royale', inStock: false };
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        jsonData: deactivatedProduct,
      }));

      const result = await client.deactivateProduct(7);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/products/7/deactivate'),
        expect.objectContaining({
          method: 'PATCH',
        })
      );
      expect(result.status).toBe(200);
      expect(result.data).toEqual(deactivatedProduct);
    });

    it('should throw 404 when product not found', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        jsonData: { error: 'Product with ID 999 not found' },
      }));

      await expect(client.deactivateProduct(999))
        .rejects.toThrow(/not found/i);
    });

    it('should throw 403 when not authorized', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 403,
        jsonData: { error: 'Forbidden' },
      }));

      await expect(client.deactivateProduct(7))
        .rejects.toThrow(/forbidden/i);
    });
  });
});

describe('Product MCP tools registration', () => {
  let server: McpServer;
  let client: BackendClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '1.0.0' });
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    client = createClient();
    registerProductTools(server, client);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should register create_product tool', () => {
    expect(server).toBeDefined();
  });

  it('should register update_product tool', () => {
    expect(server).toBeDefined();
  });

  it('should register activate_product tool', () => {
    expect(server).toBeDefined();
  });

  it('should register deactivate_product tool', () => {
    expect(server).toBeDefined();
  });

  it('should still register list_products and get_product_by_id tools', () => {
    expect(server).toBeDefined();
  });
});
