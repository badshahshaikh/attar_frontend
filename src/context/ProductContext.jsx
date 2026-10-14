import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback
} from 'react';

import {
    fetchProductById,
    fetchProducts,
    fetchProductFacets
} from '../services/productService';

const ProductContext = createContext();

export function ProductProvider({ children }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [facets, setFacets] = useState({
        brands: [],
        fragranceFamilies: []
    });

    const loadProducts = useCallback(async (
        params = {},
        { append = false } = {}
    ) => {
        try {
            setLoading(true);
            setError(null);

            const result = await fetchProducts(params);

            const productList = Array.isArray(result)
                ? result
                : result.products || [];

            setProducts(previousProducts => {
                if (!append) {
                    return productList;
                }

                // Avoid duplicate products when appending
                const existingIds = new Set(
                    previousProducts.map(product => String(product.id))
                );

                const newProducts = productList.filter(
                    product => !existingIds.has(String(product.id))
                );

                return [...previousProducts, ...newProducts];
            });

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

                const [data, productFacets] = await Promise.all([
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
                setError('Unable to load products. Please try again.');
                console.error('Failed to load products:', err);
            } finally {
                setLoading(false);
            }
        }

        initializeProducts();
    }, []);

    const getProductById = useCallback((id) => {
        if (id === undefined || id === null || id === '') {
            return undefined;
        }

        const raw = String(id).trim();
        const numericId = Number(raw);

        // Numeric database IDs: compare numerically so a string URL param
        // (`/product/76`) still matches a numeric product id (`76`).
        if (raw !== '' && Number.isFinite(numericId)) {
            const byId = products.find(
                product => Number(product.id) === numericId
            );

            if (byId) {
                return byId;
            }
        }

        // Slug lookup is explicit: a slug is never treated as a database ID.
        // The backend `GET /api/products/:id` only accepts positive integers,
        // so slugs can only resolve against the loaded catalog slice.
        const lowered = raw.toLowerCase();

        return products.find(product => {
            if (!product.slug) {
                return false;
            }

            return String(product.slug).toLowerCase() === lowered;
        });
    }, [products]);

    const getProductDetails = useCallback(async (idOrSlug) => {
        const cached = getProductById(idOrSlug);

        if (cached) {
            return cached;
        }

        // Only numeric identifiers can be fetched individually; slug-only
        // values have no single-product endpoint.
        if (!/^\d+$/.test(String(idOrSlug).trim())) {
            return undefined;
        }

        const fetched = await fetchProductById(idOrSlug);

        if (fetched && fetched.id !== undefined && fetched.id !== null) {
            setProducts(previousProducts => {
                if (previousProducts.some(
                    product => String(product.id) === String(fetched.id)
                )) {
                    return previousProducts;
                }

                return [...previousProducts, fetched];
            });
        }

        return fetched;
    }, [getProductById]);

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
        getProductDetails,
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