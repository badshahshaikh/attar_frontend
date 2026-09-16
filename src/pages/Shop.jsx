import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter } from 'lucide-react';

import { useProducts } from '../context/ProductContext';
import { useProductFilters } from '../hooks/useProductFilters';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { sortSizes } from '../features/products/utils/filterUtils';
import { SEARCH_DEBOUNCE_DELAY, PRICE_DEBOUNCE_DELAY } from '../config/constants';

import Filters from '../components/Filters/Filters';
import ProductCard from '../components/ProductCard/ProductCard';

import './Shop.css';

/**
 * Shop
 *
 * Orchestration component for the product listing page.
 * Coordinates: ProductContext, URL state, search, filters, debounce, product loading.
 * Delegates: filter state to useProductFilters, debounce to useDebouncedValue,
 *            filter UI to Filters, product rendering to ProductCard.
 */
const Shop = () => {
    // ── Data from context ───────────────────────────────────────────────────
    const {
        products,
        loading,
        error,
        loadProducts,
        fragranceFamilies,
        sizes: facetSizes
    } = useProducts();

    // ── URL state ───────────────────────────────────────────────────────────
    const [searchParams, setSearchParams] = useSearchParams();
    const searchQuery = searchParams.get('search') || '';
    const collection = searchParams.get('collection') || '';
    const brand = searchParams.get('brand') || '';

    // ── Local search input ──────────────────────────────────────────────────
    // searchTerm is local input state; searchQuery (from URL) is the source of truth.
    const [searchTerm, setSearchTerm] = useState(searchQuery);

    // Sync input from URL on external navigation (deep links, back button)
    useEffect(() => {
        setSearchTerm(searchQuery);
    }, [searchQuery]);

    // Debounce the raw input before updating the URL
    const debouncedSearch = useDebouncedValue(searchTerm, SEARCH_DEBOUNCE_DELAY);

    useEffect(() => {
        const trimmed = debouncedSearch.trim();

        setSearchParams(prev => {
            const params = new URLSearchParams(prev);

            if (trimmed) {
                params.set('search', trimmed);
            } else {
                params.delete('search');
            }

            params.set('page', '1');
            return params;
        });
    }, [debouncedSearch, setSearchParams]);

    // ── Filter state ────────────────────────────────────────────────────────
    const {
        filters,
        handleFilterChange,
        handlePriceChange,
        resetFilters: resetFilterState
    } = useProductFilters();

    // Debounce price to avoid flooding the API on every slider tick
    const debouncedPrice = useDebouncedValue(
        { minPrice: filters.minPrice, maxPrice: filters.maxPrice },
        PRICE_DEBOUNCE_DELAY
    );

    // ── Mobile drawer ───────────────────────────────────────────────────────
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

    // ── Reset: clear filter state + URL + search input ──────────────────────
    const resetFilters = () => {
        resetFilterState();
        setSearchTerm('');
        setSearchParams({});
    };

    // ── Product loading ─────────────────────────────────────────────────────
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
        filters.sizes,
        filters.inStockOnly,
        debouncedPrice.minPrice,
        debouncedPrice.maxPrice,
        brand,
        collection,
        loadProducts
    ]);

    // ── Facets ──────────────────────────────────────────────────────────────
    // Use backend-provided facets so filter options don't shrink as products are filtered.
    const availableCategories = useMemo(
        () => [...fragranceFamilies].sort(),
        [fragranceFamilies]
    );

    // Sizes come from facets; fall back to deriving from loaded products if facets are empty.
    const availableSizes = useMemo(
        () => sortSizes(facetSizes && facetSizes.length > 0
            ? facetSizes
            : products.flatMap(p => Array.isArray(p.sizes) ? p.sizes : [])
        ),
        [facetSizes, products]
    );

    // ── Render states ───────────────────────────────────────────────────────
    if (loading && products.length === 0) {
        return (
            <main className="shop-page">
                <div className="container">
                    <div className="shop-loading">Loading products...</div>
                </div>
            </main>
        );
    }

    if (error && products.length === 0) {
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

                {/* Mobile filter toggle — hidden on desktop via CSS */}
                <div
                    className="mobile-filter-toggle"
                    style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}
                >
                    <button
                        className="btn btn-outline"
                        onClick={() => setIsMobileFiltersOpen(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Filter size={16} /> Filters
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '30px' }}>
                    {/* Filter Sidebar */}
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

                    {/* Product Area */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Active URL filters indicator */}
                        {(searchQuery || collection || brand) && (
                            <div className="shop-filters">
                                {searchQuery && <span>Search: &ldquo;{searchQuery}&rdquo;</span>}
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

                        {/* Subtle loading indicator while filters update */}
                        {loading && products.length > 0 && (
                            <div className="shop-loading" style={{ padding: '10px 0', fontSize: '0.9rem' }}>
                                Updating products...
                            </div>
                        )}

                        {/* Empty state */}
                        {!loading && products.length === 0 ? (
                            <div className="shop-empty">
                                <h2>No products found</h2>
                                <p>Try adjusting your filters or search terms.</p>
                            </div>
                        ) : (
                            /* Product grid */
                            <div className="shop-grid">
                                {products.map(product => (
                                    <ProductCard key={product.id} product={product} />
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
