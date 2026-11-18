import { loadConfig, type Config } from '../config.js';

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
}

export class BackendClient {
  private config: Config;

  constructor(config?: Config) {
    this.config = config || loadConfig();
  }

  private getBackendUrl(path: string): string {
    const baseUrl = this.config.backendApiUrl.replace(/\/$/, '');
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      throw new Error(`Invalid BACKEND_API_URL: must start with http:// or https://`);
    }
    return `${baseUrl}${path}`;
  }

  async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    options?: {
      params?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
      timeout?: number;
    }
  ): Promise<ApiResponse<T>> {
    const url = new URL(this.getBackendUrl(path));

    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options?.timeout || 30000
    );

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.backendServiceKey}`,
        },
        signal: controller.signal,
        ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage: string;
        let errorData: Record<string, unknown> = {};

        try {
          errorData = await response.json();
          errorMessage = (errorData.error as string) ||
            (errorData.message as string) ||
            `HTTP ${response.status}: ${response.statusText}`;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }

        // Provide more descriptive error for common issues
        if (response.status === 404) {
          const redactedUrl = url.toString().replace(this.config.backendServiceKey, '[REDACTED]');
          errorMessage = `Backend endpoint not found (404). The BACKEND_API_URL may be misconfigured. Requested: ${redactedUrl}. Expected backend route: /api/orders`;
        } else if (response.status === 401) {
          errorMessage = `Backend authentication failed (401). The BACKEND_SERVICE_KEY may be invalid or expired.`;
        } else if (response.status === 403) {
          errorMessage = `Backend access forbidden (403). The BACKEND_SERVICE_KEY may lack required permissions.`;
        }

        const error = new Error(errorMessage);
        (error as Error & { status?: number; errorData?: Record<string, unknown> }).status = response.status;
        (error as Error & { status?: number; errorData?: Record<string, unknown> }).errorData = errorData;
        throw error;
      }

      const data = await response.json();
      return { data, status: response.status };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      // Re-throw with original error if it's already our enhanced error
      if (error instanceof Error && 'status' in error) {
        throw error;
      }
      throw error;
    }
  }

  // Orders
  async getOrders(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    paymentStatus?: string;
  }) {
    return this.request('GET', '/api/orders', { params });
  }

  async getOrderById(id: number) {
    return this.request('GET', `/api/orders/${id}`);
  }

  // Users/Customers
  async getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    return this.request('GET', '/api/users', { params });
  }

  // Products
  async getProducts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    categories?: string[];
    brands?: string[];
    minPrice?: number;
    maxPrice?: number;
    sizes?: string[];
    inStockOnly?: boolean;
  }) {
    const queryParams: Record<string, string | number | boolean | undefined> = {};

    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.search) queryParams.search = params.search;
    if (params?.minPrice !== undefined) queryParams.minPrice = params.minPrice;
    if (params?.maxPrice !== undefined) queryParams.maxPrice = params.maxPrice;
    if (params?.inStockOnly !== undefined) queryParams.inStockOnly = params.inStockOnly;

    // Handle array params
    if (params?.categories) {
      queryParams.fragranceFamily = params.categories.join(',');
    }
    if (params?.brands) {
      queryParams.brand = params.brands.join(',');
    }
    if (params?.sizes) {
      queryParams.sizes = params.sizes.join(',');
    }

    return this.request('GET', '/api/products', { params: queryParams });
  }

  async getProductById(id: number) {
    return this.request('GET', `/api/products/${id}`);
  }

  // Product management
  async createProduct(productData: unknown) {
    return this.request('POST', '/api/products', { body: productData });
  }

  async updateProduct(id: number, productData: unknown) {
    return this.request('PUT', `/api/products/${id}`, { body: productData });
  }

  async activateProduct(id: number) {
    return this.request('PATCH', `/api/products/${id}/activate`);
  }

  async deactivateProduct(id: number) {
    return this.request('PATCH', `/api/products/${id}/deactivate`);
  }

  // Health check
  async healthCheck() {
    return this.request('GET', '/api/health');
  }

  // Verify backend connectivity and configuration
  async verifyBackendConnection(): Promise<{ healthy: boolean; message: string; details?: Record<string, unknown> }> {
    try {
      const response = await this.healthCheck();
      if (response.status === 200) {
        return { healthy: true, message: 'Backend connection verified', details: response.data as Record<string, unknown> };
      }
      return { healthy: false, message: `Backend health check returned ${response.status}` };
    } catch (error) {
      if (error instanceof Error && 'status' in error) {
        return { healthy: false, message: error.message };
      }
      return { healthy: false, message: `Backend connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }
}