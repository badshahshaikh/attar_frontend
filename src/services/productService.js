/**
 * productService.js — Centralized API service for product data
 *
 * Handles all product API communication with the backend.
 * Uses environment variable for API URL configuration.
 */

import { API_URL } from '../config/api';

function normalizeProducts(products) {
    return products.map(product => ({
        ...product,
        imageUrl: product.imageUrl && product.imageUrl.startsWith('/') ? `${API_URL}${product.imageUrl}` : product.imageUrl,
    }));
}

/**
 * Fetch all products from the backend API
 */
export async function fetchProducts() {
    try {
        const response = await fetch(`${API_URL}/api/products`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return normalizeProducts(Array.isArray(data) ? data : data.products || []);
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
