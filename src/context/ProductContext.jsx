/**
 * ProductContext.jsx — Centralized product state management
 *
 * Provides products, loading state, and error state to all components.
 * Fetches products from the backend API on mount.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchProducts, fetchProductFacets } from '../services/productService';

const ProductContext = createContext();

export function ProductProvider({ children }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [facets, setFacets] = useState({ brands: [], fragranceFamilies: [] });

    useEffect(() => {
        async function loadProducts() {
            try {
                setLoading(true);
                setError(null);
                const [data, productFacets] = await Promise.all([fetchProducts(), fetchProductFacets()]);
                setProducts(data);
                setFacets(productFacets);
            } catch (err) {
                setError('Unable to load products. Please try again.');
                console.error('Failed to load products:', err);
            } finally {
                setLoading(false);
            }
        }

        loadProducts();
    }, []);

    // Helper function to get product by numeric SQLite ID
    const getProductById = (id) => {
        const productId = Number(id);
        return products.find(product => Number(product.id) === productId);
    };

    const value = {
        products,
        loading,
        error,
        getProductById,
        ...facets,
    };

    return (
        <ProductContext.Provider value={value}>
            {children}
        </ProductContext.Provider>
    );
}

export function useProducts() {
    const context = useContext(ProductContext);
    if (!context) {
        throw new Error('useProducts must be used within a ProductProvider');
    }
    return context;
}
