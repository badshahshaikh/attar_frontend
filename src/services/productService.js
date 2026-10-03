/**
 * productService.js — Centralized API service for product data
 *
 * Handles all product API communication with the backend.
 * Uses environment variable for API URL configuration.
 */

import { API_URL } from '../config/api';

async function parseResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error || data.message || 'The request could not be completed.');
        error.status = response.status;
        throw error;
    }
    return data;
}

function normalizeProducts(products) {
    return products.map(product => ({
        ...product,
        imageUrl: product.imageUrl && product.imageUrl.startsWith('/') ? `${API_URL}${product.imageUrl}` : product.imageUrl,
    }));
}

/**
 * Fetch all products from the backend API
 */
export async function fetchProducts({
    page,
    limit,
    search,
    categories,
    brands,
    minPrice,
    maxPrice,
    sizes,
    inStockOnly
} = {}) {
    try {
        const params = new URLSearchParams();

        // Pagination
        if (page) {
            params.set('page', page);
        }

        if (limit) {
            params.set('limit', limit);
        }

        // Search
        if (search) {
            params.set('search', search);
        }

        // Fragrance Profile
        if (Array.isArray(categories)) {
            categories.forEach((category) => {
                if (category) {
                    params.append(
                        'fragranceFamily',
                        category
                    );
                }
            });
        }

        // Brands
        if (Array.isArray(brands)) {
            brands.forEach((brand) => {
                if (brand) {
                    params.append('brand', brand);
                }
            });
        }

        // Price
        if (
            minPrice !== undefined &&
            minPrice !== null
        ) {
            params.set('minPrice', minPrice);
        }

        if (
            maxPrice !== undefined &&
            maxPrice !== null
        ) {
            params.set('maxPrice', maxPrice);
        }

        // Sizes
        if (Array.isArray(sizes)) {
            sizes.forEach((size) => {
                if (size) {
                    params.append('sizes', size);
                }
            });
        }

        // Stock
        if (inStockOnly !== undefined) {
            params.set(
                'inStockOnly',
                String(inStockOnly)
            );
        }

        const query = params.toString();

        const response = await fetch(
            `${API_URL}/api/products${query ? `?${query}` : ''}`
        );

        if (!response.ok) {
            throw new Error(
                `HTTP error! status: ${response.status}`
            );
        }

        const data = await response.json();

        if (Array.isArray(data)) {
            return normalizeProducts(data);
        }

        const products = normalizeProducts(
            data.products || []
        );

        return (
            page ||
            limit ||
            search ||
            categories?.length ||
            brands?.length ||
            sizes?.length ||
            minPrice !== undefined ||
            maxPrice !== undefined ||
            inStockOnly !== undefined
        )
            ? {
                ...data,
                products
            }
            : products;

    } catch (error) {
        console.error(
            'Error fetching products:',
            error
        );

        throw error;
    }
}

export async function generateProductImageWithAI(productData) {
    try {
        const response = await fetch(
            `${API_URL}/api/products/ai-image`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(productData)
            }
        );

        const data = await parseResponse(response);

        return data.image;
    } catch (error) {
        console.error('Error generating product image with AI:', error);
        throw error;
    }
}

export async function fetchProductFacets() {
    const [brandsResponse, categoriesResponse, familiesResponse] = await Promise.all([
        fetch(`${API_URL}/api/catalog/brands`),
        fetch(`${API_URL}/api/catalog/categories`),
        fetch(`${API_URL}/api/products/fragrance-families`),
    ]);
    if (!brandsResponse.ok || !categoriesResponse.ok || !familiesResponse.ok) throw new Error('Unable to load product navigation');
    return {
        brands: await brandsResponse.json(),
        categories: await categoriesResponse.json(),
        fragranceFamilies: await familiesResponse.json()
    };
}

/**
 * Fetch a single product by ID from the backend API
 */
export async function fetchProductById(id) {
    try {
        const response = await fetch(`${API_URL}/api/products/${id}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return { ...data, imageUrl: data.imageUrl && data.imageUrl.startsWith('/') ? `${API_URL}${data.imageUrl}` : data.imageUrl };
    } catch (error) {
        console.error('Error fetching product:', error);
        throw error;
    }
}

export async function createProduct(payload) {
    const response = await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
    });
    return parseResponse(response);
}

export async function updateProduct(id, payload) {
    const response = await fetch(`${API_URL}/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
    });
    return parseResponse(response);
}

export async function deleteProduct(id) {
    const response = await fetch(`${API_URL}/api/products/${id}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    return parseResponse(response);
}

export async function uploadProductImage(file, productId) {
    const formData = new FormData();
    formData.append('image', file);
    if (productId) formData.append('productId', String(productId));

    const response = await fetch(`${API_URL}/api/products/upload-image`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
    });
    return parseResponse(response);
}

export async function bulkUpsertProducts({ create = [], update = [] }) {
    const response = await fetch(`${API_URL}/api/products/bulk-upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ create, update }),
    });
    return parseResponse(response);
}

/**
 * Generate product information using AI
 */
export async function generateProductWithAI(name) {
    try {
        const response = await fetch(
            `${API_URL}/api/products/ai-fill`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    name
                })
            }
        );

        const data = await parseResponse(response);

        return data.product;
    } catch (error) {
        console.error(
            'Error generating product with AI:',
            error
        );

        throw error;
    }
}
