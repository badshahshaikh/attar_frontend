import React, { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import './Filters.css';

const Filters = ({
    isOpen, onClose,
    searchTerm, setSearchTerm,
    filters, handleFilterChange, resetFilters,
    availableCategories, availableSizes
}) => {
    const [openSections, setOpenSections] = useState({
        search: true,
        category: true,
        price: true,
        size: false
    });

    const toggleSection = (section) => {
        setOpenSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && <div className="filter-backdrop" onClick={onClose}></div>}

            <aside className={`filters-sidebar ${isOpen ? 'open' : ''}`}>
                <div className="filters-header">
                    <h3>Filter By</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button className="reset-filters-btn" onClick={resetFilters}>Reset</button>
                        <button className="close-filter-btn" onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="filter-sections">
                    {/* Search Field */}
                    <div className="filter-section">
                        <div className="filter-section-header" onClick={() => toggleSection('search')}>
                            <h4>Search</h4>
                            <ChevronDown
                                size={16}
                                className={`filter-chevron ${openSections.search ? 'open' : ''}`}
                            />
                        </div>
                        {openSections.search && (
                            <div className="filter-options">
                                <div className="search-input-wrapper">
                                    <input
                                        type="text"
                                        placeholder="Search attars..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="filter-search-input"
                                    />
                                    {searchTerm && (
                                        <button className="clear-search" onClick={() => setSearchTerm('')}>
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Category Filter */}
                    <div className="filter-section">
                        <div className="filter-section-header" onClick={() => toggleSection('category')}>
                            <h4>Fragrance Profile</h4>
                            <ChevronDown
                                size={16}
                                className={`filter-chevron ${openSections.category ? 'open' : ''}`}
                            />
                        </div>
                        {openSections.category && (
                            <div className="filter-options">
                                {availableCategories.map(cat => (
                                    <label key={cat} className="filter-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={filters.categories.includes(cat)}
                                            onChange={() => handleFilterChange('categories', cat)}
                                        />
                                        <span>{cat}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Price Filter */}
                    <div className="filter-section">
                        <div className="filter-section-header" onClick={() => toggleSection('price')}>
                            <h4>Price Range</h4>
                            <ChevronDown
                                size={16}
                                className={`filter-chevron ${openSections.price ? 'open' : ''}`}
                            />
                        </div>
                        {openSections.price && (
                            <div className="filter-options">
                                <label className="filter-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={filters.priceRanges.includes('under2000')}
                                        onChange={() => handleFilterChange('priceRanges', 'under2000')}
                                    />
                                    <span>Under ₹2000</span>
                                </label>
                                <label className="filter-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={filters.priceRanges.includes('2000-4000')}
                                        onChange={() => handleFilterChange('priceRanges', '2000-4000')}
                                    />
                                    <span>₹2000 - ₹4000</span>
                                </label>
                                <label className="filter-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={filters.priceRanges.includes('above4000')}
                                        onChange={() => handleFilterChange('priceRanges', 'above4000')}
                                    />
                                    <span>Above ₹4000</span>
                                </label>
                            </div>
                        )}
                    </div>

                    {/* Size Filter */}
                    <div className="filter-section">
                        <div className="filter-section-header" onClick={() => toggleSection('size')}>
                            <h4>Size</h4>
                            <ChevronDown
                                size={16}
                                className={`filter-chevron ${openSections.size ? 'open' : ''}`}
                            />
                        </div>
                        {openSections.size && (
                            <div className="filter-options">
                                {availableSizes.map(size => (
                                    <label key={size} className="filter-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={filters.sizes.includes(size)}
                                            onChange={() => handleFilterChange('sizes', size)}
                                        />
                                        <span>{size}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Availability */}
                    <div className="filter-section">
                        <label className="filter-switch">
                            <input
                                type="checkbox"
                                checked={filters.inStockOnly}
                                onChange={(e) => handleFilterChange('inStockOnly', e.target.checked)}
                            />
                            <span>In Stock Only</span>
                        </label>
                    </div>
                </div>

                <div className="filter-actions-mobile">
                    <button className="btn btn-primary" onClick={onClose}>Apply Filters</button>
                    <button className="btn" onClick={resetFilters} style={{ marginTop: '10px', backgroundColor: 'transparent', border: '1px solid var(--color-border)' }}>Reset All</button>
                </div>
            </aside>
        </>
    );
};

export default Filters;
