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
export async function fetchProducts({ page, limit, search } = {}) {
    try {
        const params = new URLSearchParams();
        if (page) params.set('page', page);
        if (limit) params.set('limit', limit);
        if (search) params.set('search', search);
        const query = params.toString();
        const response = await fetch(`${API_URL}/api/products${query ? `?${query}` : ''}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (Array.isArray(data)) return normalizeProducts(data);
        const products = normalizeProducts(data.products || []);
        return page || limit || search ? { ...data, products } : products;
    } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
    }
}

export async function fetchProductFacets() {
    const [brandsResponse, familiesResponse] = await Promise.all([
        fetch(`${API_URL}/api/products/brands`),
        fetch(`${API_URL}/api/products/fragrance-families`),
    ]);
    if (!brandsResponse.ok || !familiesResponse.ok) throw new Error('Unable to load product navigation');
    return { brands: await brandsResponse.json(), fragranceFamilies: await familiesResponse.json() };
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
