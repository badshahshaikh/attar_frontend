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
import LoadMoreButton from "../components/LoadMoreButton/LoadMoreButton";
import './Shop.css';
import { fetchJson } from '../utils/api';
import { buildProductQuery } from '../utils/productQuery';
import {
    getAvailableCategories,
    getAvailableFragranceFamilies,
    getAvailableSizes,
} from '../utils/productFacets';
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

    // ── Catalog data (brands/categories) ───────────────────────────────────
    const [brands, setBrands] = useState([]);
    const [categories, setCategories] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(true);

    useEffect(() => {
        const loadCatalog = async () => {
            try {
                const [brands, categories] = await Promise.all([
                    fetchJson('/api/catalog/brands'),
                    fetchJson('/api/catalog/categories'),
                ]);

                setBrands(brands);
                setCategories(categories);
            } catch (err) {
                console.error('Failed to load catalog data:', err);
            } finally {
                setCatalogLoading(false);
            }
        };

        loadCatalog();
    }, []);

    // ── URL state ───────────────────────────────────────────────────────────
    const [searchParams, setSearchParams] = useSearchParams();
    const searchQuery = searchParams.get('search') || '';
    const collection = searchParams.get('collection') || '';
    const brandsFromUrl = searchParams.getAll('brand');
    const category = searchParams.get('category') || '';

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

        if (trimmed === searchQuery) return;

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
    }, [debouncedSearch, searchQuery, setSearchParams]);

    // ── Filter state ────────────────────────────────────────────────────────
    const {
        filters,
        setFilters, // Add this
        handleFilterChange,
        handlePriceChange,
        resetFilters: resetFilterState,
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

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const PRODUCTS_PER_PAGE = 12;
    const productParams = {
        limit: PRODUCTS_PER_PAGE,
        search: searchQuery,
        categories: filters.categories,
        brands: filters.brands || [],
        sizes: filters.sizes,
        minPrice: debouncedPrice.minPrice,
        maxPrice: debouncedPrice.maxPrice,
        inStockOnly: filters.inStockOnly,
        category,
    };
    useEffect(() => {
        let isActive = true;

        const loadFirstPage = async () => {
            setPage(1);
            setHasMore(true);

            try {
                const result = await loadProducts({
                    ...productParams,
                    page: 1,
                });

                if (!isActive) return;

                const productList = Array.isArray(result)
                    ? result
                    : result.products || [];

                setHasMore(
                    result.totalPages
                        ? 1 < result.totalPages
                        : productList.length === PRODUCTS_PER_PAGE
                );
            } catch {
                if (isActive) {
                    setHasMore(false);
                }
            }
        };

        loadFirstPage();

        return () => {
            isActive = false;
        };
    }, [
        searchQuery,
        filters.categories,
        filters.sizes,
        filters.inStockOnly,
        debouncedPrice.minPrice,
        debouncedPrice.maxPrice,
        filters.brands,
        category,
        loadProducts,
    ]);

    const handleLoadMore = async () => {
        if (loading || !hasMore) return;

        const nextPage = page + 1;

        try {
            const result = await loadProducts(
                {
                    ...productParams,
                    page: nextPage,
                },
                { append: true }
            );

            const productList = Array.isArray(result)
                ? result
                : result.products || [];

            setPage(nextPage);

            setHasMore(
                result.totalPages
                    ? nextPage < result.totalPages
                    : productList.length === PRODUCTS_PER_PAGE
            );
        } catch {
            // Keep the current page so the user can retry.
        }
    };

    useEffect(() => {
        const collections = searchParams.getAll('collection');

        setFilters(previous => {
            const currentCategories = previous.categories || [];

            // Don't update state if the values are already the same
            const areSame =
                currentCategories.length === collections.length &&
                currentCategories.every(
                    (value, index) => value === collections[index]
                );

            if (areSame) {
                return previous;
            }

            return {
                ...previous,
                categories: collections,
            };
        });
    }, [searchParams, setFilters]);

    useEffect(() => {
        const brandsFromUrl = searchParams.getAll('brand');

        setFilters(previous => {
            const currentBrands = previous.brands || [];

            const areSame =
                currentBrands.length === brandsFromUrl.length &&
                currentBrands.every(
                    (value, index) => value === brandsFromUrl[index]
                );

            if (areSame) {
                return previous;
            }

            return {
                ...previous,
                brands: brandsFromUrl,
            };
        });
    }, [searchParams, setFilters]);

    // ── Facets ──────────────────────────────────────────────────────────────

    const availableCategories = useMemo(
        () => getAvailableCategories(categories),
        [categories]
    );

    const availableFragranceFamilies = useMemo(
        () => getAvailableFragranceFamilies(fragranceFamilies),
        [fragranceFamilies]
    );

    const availableSizes = useMemo(
        () => getAvailableSizes({
            facetSizes,
            products,
            sortSizes,
        }),
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

    const handleFragranceFilterChange = (value) => {
        const currentCategories = filters.categories || [];

        const updatedCategories = currentCategories.includes(value)
            ? currentCategories.filter(item => item !== value)
            : [...currentCategories, value];

        // Update checkbox state with all selected values
        setFilters(previous => ({
            ...previous,
            categories: updatedCategories,
        }));

        // Update URL with all selected fragrance families
        const params = new URLSearchParams(searchParams);

        params.delete('collection');

        updatedCategories.forEach(item => {
            params.append('collection', item);
        });

        params.delete('page');
        setSearchParams(params);
    };

    const handleBrandFilterChange = (value) => {
        const currentBrands = filters.brands || [];

        const updatedBrands = currentBrands.includes(value)
            ? currentBrands.filter(item => item !== value)
            : [...currentBrands, value];

        setFilters(previous => ({
            ...previous,
            brands: updatedBrands,
        }));

        const params = new URLSearchParams(searchParams);

        params.delete('brand');

        updatedBrands.forEach(item => {
            params.append('brand', item);
        });

        params.delete('page');
        setSearchParams(params);
    };



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
                        handleFragranceFilterChange={handleFragranceFilterChange}
                        handleBrandFilterChange={handleBrandFilterChange}
                        handlePriceChange={handlePriceChange}
                        resetFilters={resetFilters}
                        availableCategories={availableFragranceFamilies}
                        availableBrands={brands.map(b => b.name)}
                        availableSizes={availableSizes}
                    />

                    {/* Product Area */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Active URL filters indicator */}
                        {(searchQuery || brandsFromUrl.length > 0 || collection || category) && (
                            <div className="shop-filters">
                                {searchQuery && (
                                    <span>Search: &ldquo;{searchQuery}&rdquo;</span>
                                )}

                                {collection && (
                                    <span>Collection: {collection}</span>
                                )}

                                {brandsFromUrl.length > 0 && (
                                    <span>
                                        Brand: {brandsFromUrl.join(', ')}
                                    </span>
                                )}

                                {category && (
                                    <span>Category: {category}</span>
                                )}

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

                        <LoadMoreButton
                            onClick={handleLoadMore}
                            loading={loading}
                            hasMore={hasMore}
                        />

                    </div>
                </div>

                
            </div>
        </main>
    );
};

export default Shop;
