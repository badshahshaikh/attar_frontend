import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb/Breadcrumb';
import PageHeader from '../components/PageHeader/PageHeader';
import Filters from '../components/Filters/Filters';
import Sorting from '../components/Sorting/Sorting';
import ProductGrid from '../components/ProductGrid/ProductGrid';
import { useProducts } from '../context/ProductContext';
import PageLoader from "../components/PageLoader/PageLoader";

const Shop = () => {
    const { products, loading, error } = useProducts();
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();

    // Search & Filter State
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [filters, setFilters] = useState(() => {
        const collection = searchParams.get('collection');
        const brand = searchParams.get('brand');
        return {
            categories: collection ? [collection] : [],
            brand: brand || '',
            priceRanges: [],
            sizes: [],
            inStockOnly: false
        };
    });
    const [sortType, setSortType] = useState('popularity');

    useEffect(() => {
        const query = searchParams.get('search');
        if (query !== null && query !== searchTerm) {
            setSearchTerm(query);
        }

        const collection = searchParams.get('collection');
        const brand = searchParams.get('brand');
        setFilters(prev => {
            const nextCategories = collection ? [collection] : [];
            const nextBrand = brand || '';
            if (JSON.stringify(prev.categories) === JSON.stringify(nextCategories) && prev.brand === nextBrand) {
                return prev;
            }
            return { ...prev, categories: nextCategories, brand: nextBrand };
        });
    }, [searchParams]);

    const toggleFilters = () => setIsFilterOpen(!isFilterOpen);

    const handleFilterChange = (filterType, value) => {
        setFilters(prev => {
            if (filterType === 'inStockOnly') {
                return { ...prev, inStockOnly: value };
            }

            if (filterType === 'brand') {
                return { ...prev, brand: value };
            }

            const currentSelected = prev[filterType];
            const isSelected = currentSelected.includes(value);

            if (isSelected) {
                return { ...prev, [filterType]: currentSelected.filter(item => item !== value) };
            } else {
                return { ...prev, [filterType]: [...currentSelected, value] };
            }
        });
    };

    const resetFilters = () => {
        setSearchTerm('');
        const params = new URLSearchParams(searchParams.toString());
        params.delete('search');
        params.delete('collection');
        params.delete('brand');
        setSearchParams(params);
        setFilters({
            categories: [],
            brand: '',
            priceRanges: [],
            sizes: [],
            inStockOnly: false
        });
        setSortType('popularity');
    };

    const filteredAndSortedProducts = useMemo(() => {
        let result = [...products];

        // 1. Search
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(p =>
                (p.name || '').toLowerCase().includes(lowerSearch) ||
                (p.description || '').toLowerCase().includes(lowerSearch) ||
                (p.fragranceType || '').toLowerCase().includes(lowerSearch) ||
                (p.topNotes || []).some(n => (n || '').toLowerCase().includes(lowerSearch)) ||
                (p.heartNotes || []).some(n => (n || '').toLowerCase().includes(lowerSearch)) ||
                (p.baseNotes || []).some(n => (n || '').toLowerCase().includes(lowerSearch)) ||
                (p.fullDescription || '').toLowerCase().includes(lowerSearch)
            );
        }

        // 2. Categories
        if (filters.categories.length > 0) {
            // Handle special collections
            if (filters.categories.includes('best-sellers')) {
                result = result.filter(p => p.isBestSeller);
            } else if (filters.categories.includes('exclusive')) {
                result = result.filter(p => p.isExclusive);
            } else {
                result = result.filter(p => filters.categories.includes(p.fragranceType));
            }
        }

        // 2.5. Brand
        if (filters.brand) {
            result = result.filter(p => p.brand === filters.brand);
        }

        // 3. Sizes
        if (filters.sizes.length > 0) {
            result = result.filter(p => p.sizes.some(s => filters.sizes.includes(s)));
        }

        // 4. In Stock
        if (filters.inStockOnly) {
            result = result.filter(p => p.inStock);
        }

        // 5. Price Ranges
        if (filters.priceRanges.length > 0) {
            result = result.filter(p => {
                const basePrice = Math.min(...Object.values(p.sizePricing));
                return filters.priceRanges.some(range => {
                    if (range === 'under2000') return basePrice < 2000;
                    if (range === '2000-4000') return basePrice >= 2000 && basePrice <= 4000;
                    if (range === 'above4000') return basePrice > 4000;
                    return false;
                });
            });
        }

        // 6. Sorting
        if (sortType === 'popularity') {
            result.sort((a, b) => b.reviews - a.reviews);
        } else if (sortType === 'newest') {
            result.sort((a, b) => (a.isNew === b.isNew) ? 0 : a.isNew ? -1 : 1);
        } else if (sortType === 'price-low') {
            result.sort((a, b) => Math.min(...Object.values(a.sizePricing)) - Math.min(...Object.values(b.sizePricing)));
        } else if (sortType === 'price-high') {
            result.sort((a, b) => Math.min(...Object.values(b.sizePricing)) - Math.min(...Object.values(a.sizePricing)));
        }

        return result;
    }, [products, searchTerm, filters, sortType]);

    const availableCategories = useMemo(() => {
        return [...new Set(products.map(p => p.fragranceType))];
    }, [products]);

    const availableSizes = useMemo(() => {
        return [...new Set(products.flatMap(p => p.sizes))];
    }, [products]);

    if (loading) {
        return (
            <main>
                <Breadcrumb />
                <PageHeader />
                <PageLoader />
            </main>
        );
    }

    if (error) {
        return (
            <main>
                <Breadcrumb />
                <PageHeader />
                <section className="shop-section container">
                    <div className="shop-layout">
                        <div className="shop-content" style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <h2 style={{ fontSize: '1.8rem', fontWeight: 300, marginBottom: '16px', color: 'var(--text-color)' }}>{error}</h2>
                        </div>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main>
            <Breadcrumb />
            <PageHeader />

            <section className="shop-section container">
                <div className="shop-layout">
                    <Filters
                        isOpen={isFilterOpen}
                        onClose={() => setIsFilterOpen(false)}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        filters={filters}
                        handleFilterChange={handleFilterChange}
                        resetFilters={resetFilters}
                        availableCategories={availableCategories}
                        availableSizes={availableSizes}
                    />

                    <div className="shop-content">
                        <Sorting
                            toggleFilters={toggleFilters}
                            sortType={sortType}
                            setSortType={setSortType}
                            totalResults={filteredAndSortedProducts.length}
                        />

                        {filteredAndSortedProducts.length > 0 ? (
                            <ProductGrid products={filteredAndSortedProducts} />
                        ) : (
                            <div className="empty-results-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
                                <h2 style={{ fontSize: '1.8rem', fontWeight: 300, marginBottom: '16px', color: 'var(--text-color)' }}>No attars found</h2>
                                <p style={{ color: 'var(--text-light)', marginBottom: '24px' }}>We couldn't find any products matching your current filters and search.</p>
                                <button className="btn btn-primary" onClick={resetFilters}>Clear All Filters</button>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
};

export default Shop;
