/**
 * ProductContext.jsx — Centralized product state management
 *
 * Provides products, loading state, and error state to all components.
 * Fetches products from the backend API on mount.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchProducts } from '../services/productService';

const ProductContext = createContext();

export function ProductProvider({ children }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function loadProducts() {
            try {
                setLoading(true);
                setError(null);
                const data = await fetchProducts();
                setProducts(data);
            } catch (err) {
                setError('Unable to load products. Please try again.');
                console.error('Failed to load products:', err);
            } finally {
                setLoading(false);
            }
        }

        loadProducts();
    }, []);

    // Helper function to get product by ID
    const getProductById = (id) => {
        return products.find(product => product.id === id);
    };

    const value = {
        products,
        loading,
        error,
        getProductById,
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
