import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard/ProductCard';
import Filters from '../components/Filters/Filters';
import { useProducts } from '../context/ProductContext';
import { Filter } from 'lucide-react';
import './Shop.css';

const Shop = () => {
    const {
        products,
        loading,
        error,
        loadProducts,
        fragranceFamilies,
        brands,
        sizes
    } = useProducts();
    const [searchTerm, setSearchTerm] = useState('');

    const [searchParams, setSearchParams] = useSearchParams();

    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);



    useEffect(() => {
        const timer = setTimeout(() => {
            const trimmedSearch = searchTerm.trim();

            setSearchParams(prev => {
                const params = new URLSearchParams(prev);

                if (trimmedSearch) {
                    params.set('search', trimmedSearch);
                } else {
                    params.delete('search');
                }

                params.set('page', '1');

                return params;
            });
        }, 400);

        return () => clearTimeout(timer);
    }, [searchTerm, setSearchParams]);


    const [filters, setFilters] = useState({
        categories: [],
        minPrice: 0,
        maxPrice: 10000,
        sizes: [],
        inStockOnly: false
    });

    const [debouncedPrice, setDebouncedPrice] = useState({
        minPrice: 0,
        maxPrice: 10000
    });

    const searchQuery = searchParams.get('search') || '';
    const collection = searchParams.get('collection') || '';
    const brand = searchParams.get('brand') || '';

    // Initialize local search term from URL query if present
    useEffect(() => {
        setSearchTerm(searchQuery);
    }, [searchQuery]);

    useEffect(() => {
        loadProducts({
            page: 1,
            limit: 50,
            search: searchQuery,
            categories: filters.categories,
            sizes: filters.sizes,
            minPrice: debouncedPrice.minPrice,
            maxPrice: debouncedPrice.maxPrice,
            inStockOnly: filters.inStockOnly,
            brand,
            collection
        });
    }, [
        searchQuery,
        filters.categories,
        debouncedPrice.minPrice,
        debouncedPrice.maxPrice,
        filters.sizes,
        filters.inStockOnly,
        brand,
        collection,
        loadProducts
    ]);

    // Compute dynamic filter options
    // const availableCategories = useMemo(() =>
    //     [...new Set(products.map(p => p.fragranceType).filter(Boolean))],
    //     [products]);

    const availableCategories = [...fragranceFamilies].sort();

    const availableSizes = useMemo(
        () =>
            [
                ...new Set(
                    products
                        .flatMap(product =>
                            Array.isArray(product.sizes)
                                ? product.sizes
                                : []
                        )
                        .filter(Boolean)
                )
            ].sort((a, b) => {
                const sizeA = parseFloat(a);
                const sizeB = parseFloat(b);

                if (
                    Number.isFinite(sizeA) &&
                    Number.isFinite(sizeB)
                ) {
                    return sizeA - sizeB;
                }

                return String(a).localeCompare(String(b));
            }),
        [products]
    );

    const handleFilterChange = (filterType, value) => {
        setFilters((previous) => {
            const currentValues = previous[filterType] || [];

            const updatedValues = currentValues.includes(value)
                ? currentValues.filter((item) => item !== value)
                : [...currentValues, value];

            return {
                ...previous,
                [filterType]: updatedValues
            };
        });
    };




    const handlePriceChange = (type, value) => {
        setFilters(prev => {
            if (type === 'minPrice') {
                return {
                    ...prev,
                    minPrice: Math.min(value, prev.maxPrice)
                };
            }

            if (type === 'maxPrice') {
                return {
                    ...prev,
                    maxPrice: Math.max(value, prev.minPrice)
                };
            }

            return prev;
        });
    };



    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedPrice({
                minPrice: filters.minPrice,
                maxPrice: filters.maxPrice
            });
        }, 500);

        return () => clearTimeout(timer);
    }, [
        filters.minPrice,
        filters.maxPrice
    ]);


    const resetFilters = () => {
        setFilters({ categories: [], minPrice: 0, maxPrice: 10000, sizes: [], inStockOnly: false });
        setSearchTerm('');
        setSearchParams({});
    };

    if (loading) {
        return (
            <main className="shop-page">
                <div className="container">
                    <div className="shop-loading">Loading products...</div>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="shop-page">
                <div className="container">
                    <div className="shop-error">{error}</div>
                </div>
            </main>
        );
    }

    return (
        <main className="shop-page">
            <div className="container">
                <div className="shop-header">
                    <h1>Shop All Fragrances</h1>
                    <p>Discover our complete collection of premium attars and fragrances.</p>
                </div>

                <div className="mobile-filter-toggle" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                    <button
                        className="btn btn-outline"
                        onClick={() => setIsMobileFiltersOpen(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Filter size={16} /> Filters
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '30px' }}>
                    <Filters
                        isOpen={isMobileFiltersOpen}
                        onClose={() => setIsMobileFiltersOpen(false)}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        filters={filters}
                        handleFilterChange={handleFilterChange}
                        handlePriceChange={handlePriceChange}
                        resetFilters={resetFilters}
                        availableCategories={availableCategories}
                        availableSizes={availableSizes}
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                        {(searchQuery || collection || brand) && (
                            <div className="shop-filters">
                                {searchQuery && <span>Search: "{searchQuery}"</span>}
                                {collection && <span>Collection: {collection}</span>}
                                {brand && <span>Brand: {brand}</span>}
                                <button
                                    className="btn btn-outline btn-small"
                                    onClick={() => setSearchParams({})}
                                >
                                    Clear URL Filters
                                </button>
                            </div>
                        )}

                        {!loading && products.length === 0 ? (
                            <div className="shop-empty">
                                <h2>No products found</h2>
                                <p>Try adjusting your filters or search terms.</p>
                            </div>
                        ) : (
                            <div className="shop-grid">
                                {products.map(product => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Shop;
