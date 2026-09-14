import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback
} from 'react';

import {
    fetchProducts,
    fetchProductFacets
} from '../services/productService';

const ProductContext = createContext();

export function ProductProvider({ children }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [facets, setFacets] = useState({
        brands: [],
        fragranceFamilies: []
    });

    const loadProducts = useCallback(async (params = {}) => {
        try {
            setLoading(true);
            setError(null);

            const result = await fetchProducts(params);

            const productList = Array.isArray(result)
                ? result
                : result.products || [];

            setProducts(productList);

            return result;
        } catch (err) {
            setError(
                'Unable to load products. Please try again.'
            );

            console.error(
                'Failed to load products:',
                err
            );

            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        async function initializeProducts() {
            try {
                setLoading(true);
                setError(null);

                const [data, productFacets] =
                    await Promise.all([
                        fetchProducts(),
                        fetchProductFacets()
                    ]);

                setProducts(
                    Array.isArray(data)
                        ? data
                        : data.products || []
                );

                setFacets(productFacets);
            } catch (err) {
                setError(
                    'Unable to load products. Please try again.'
                );

                console.error(
                    'Failed to load products:',
                    err
                );
            } finally {
                setLoading(false);
            }
        }

        initializeProducts();
    }, []);

    const getProductById = (id) => {
        const productId = Number(id);

        return products.find(
            product =>
                Number(product.id) === productId
        );
    };

    const searchProducts = async (
        query,
        limit = 5
    ) => {
        const trimmedQuery = query.trim();

        if (!trimmedQuery) {
            return [];
        }

        const result = await fetchProducts({
            search: trimmedQuery,
            limit
        });

        return result.products || [];
    };

    const value = {
        products,
        loading,
        error,
        loadProducts,
        getProductById,
        searchProducts,
        ...facets
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
        throw new Error(
            'useProducts must be used within a ProductProvider'
        );
    }

    return context;
}