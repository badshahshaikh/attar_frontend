import React from 'react';
import { X } from 'lucide-react';
import FilterSection from './FilterSection';
import CheckboxFilter from './CheckboxFilter';
import PriceRangeFilter from './PriceRangeFilter';
import './Filters.css';

/**
 * Filters (ShopFilters)
 *
 * Composes the filter sidebar for the Shop page.
 * Does NOT own filter state — receives everything via props.
 * Can be reused on any product listing page.
 *
 * Props:
 *   isOpen             {boolean}  - Mobile drawer open state.
 *   onClose            {function} - Close the mobile drawer.
 *   searchTerm         {string}   - Current search input value.
 *   setSearchTerm      {function} - Update search input.
 *   filters            {object}   - Current filters { categories, minPrice, maxPrice, sizes, inStockOnly }.
 *   handleFilterChange {function} - Toggle an item in an array filter or set a boolean.
 *   handlePriceChange  {function} - Update min/max price.
 *   resetFilters       {function} - Restore all filters to defaults.
 *   availableCategories {string[]} - Fragrance family options.
 *   availableBrands    {string[]} - Brand options.
 *   availableSizes      {string[]} - Size options.
 */
const Filters = ({
    isOpen,
    onClose,
    searchTerm,
    setSearchTerm,
    filters,
    handleFilterChange,
    handleFragranceFilterChange,
    handlePriceChange,
    resetFilters,
    availableCategories,
    availableBrands,
    availableSizes
}) => {
    return (
        <>
            {/* Mobile backdrop */}
            {isOpen && <div className="filter-backdrop" onClick={onClose} />}

            <aside className={`filters-sidebar ${isOpen ? 'open' : ''}`}>
                <div className="filters-header">
                    <h3>Filter By</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button className="reset-filters-btn" onClick={resetFilters}>
                            Reset
                        </button>
                        <button className="close-filter-btn" onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="filter-sections">
                    {/* Search */}
                    <FilterSection title="Search" defaultOpen>
                        <div className="search-input-wrapper">
                            <input
                                type="text"
                                placeholder="Search attars..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="filter-search-input"
                            />
                            {searchTerm && (
                                <button
                                    className="clear-search"
                                    onClick={() => setSearchTerm('')}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </FilterSection>

                    {/* Fragrance Profile */}
                    <FilterSection title="Fragrance Profile" defaultOpen>
                        <CheckboxFilter
                            options={availableCategories}
                            selected={filters.categories}
                            onChange={handleFragranceFilterChange}
                        />
                    </FilterSection>

                    {/* Brand */}
                    {availableBrands && availableBrands.length > 0 && (
                        <FilterSection title="Brand" defaultOpen={false}>
                            <CheckboxFilter
                                options={availableBrands}
                                selected={filters.brands}
                                onChange={value => handleFilterChange('brands', value)}
                            />
                        </FilterSection>
                    )}

                    {/* Price Range */}
                    <FilterSection title="Price Range" defaultOpen>
                        <PriceRangeFilter
                            min={filters.minPrice}
                            max={filters.maxPrice}
                            onChange={handlePriceChange}
                        />
                    </FilterSection>

                    {/* Size */}
                    <FilterSection title="Size" defaultOpen={false}>
                        <CheckboxFilter
                            options={availableSizes}
                            selected={filters.sizes}
                            onChange={value => handleFilterChange('sizes', value)}
                        />
                    </FilterSection>

                    {/* In Stock Only */}
                    <div className="filter-section">
                        <label className="filter-switch">
                            <input
                                type="checkbox"
                                checked={filters.inStockOnly}
                                onChange={e =>
                                    handleFilterChange('inStockOnly', e.target.checked)
                                }
                            />
                            <span>In Stock Only</span>
                        </label>
                    </div>
                </div>

                {/* Mobile apply/reset actions */}
                <div className="filter-actions-mobile">
                    <button className="btn btn-primary" onClick={onClose}>
                        Apply Filters
                    </button>
                    <button
                        className="btn"
                        onClick={resetFilters}
                        style={{
                            marginTop: '10px',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--color-border)'
                        }}
                    >
                        Reset All
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Filters;
