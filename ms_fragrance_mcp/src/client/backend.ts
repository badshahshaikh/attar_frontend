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

  async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    options?: {
      params?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
      timeout?: number;
    }
  ): Promise<ApiResponse<T>> {
    const url = new URL(`${this.config.backendApiUrl}${path}`);

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
          Authorization: `Bearer ${this.config.backendAdminToken}`,
        },
        credentials: 'include',
        signal: controller.signal,
        ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(
          (errorData as { error?: string; message?: string }).error ||
            (errorData as { error?: string; message?: string }).message ||
            `HTTP ${response.status}: ${response.statusText}`
        );
        (error as Error & { status?: number }).status = response.status;
        throw error;
      }

      const data = await response.json();
      return { data, status: response.status };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out');
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

  // Health check
  async healthCheck() {
    return this.request('GET', '/api/health');
  }
}