import React, { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import './Filters.css';

const Filters = ({ isOpen, onClose }) => {
    const [openSections, setOpenSections] = useState({
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
                    <button className="close-filter-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="filter-sections">
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
                                <label className="filter-checkbox">
                                    <input type="checkbox" /> <span>Woody & Earthy</span>
                                </label>
                                <label className="filter-checkbox">
                                    <input type="checkbox" /> <span>Floral & Fresh</span>
                                </label>
                                <label className="filter-checkbox">
                                    <input type="checkbox" /> <span>Musk</span>
                                </label>
                                <label className="filter-checkbox">
                                    <input type="checkbox" /> <span>Oriental & Spicy</span>
                                </label>
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
                                    <input type="checkbox" /> <span>Under ₹2000</span>
                                </label>
                                <label className="filter-checkbox">
                                    <input type="checkbox" /> <span>₹2000 - ₹4000</span>
                                </label>
                                <label className="filter-checkbox">
                                    <input type="checkbox" /> <span>Above ₹4000</span>
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
                                <label className="filter-checkbox">
                                    <input type="checkbox" /> <span>3ml</span>
                                </label>
                                <label className="filter-checkbox">
                                    <input type="checkbox" /> <span>6ml</span>
                                </label>
                                <label className="filter-checkbox">
                                    <input type="checkbox" /> <span>12ml</span>
                                </label>
                            </div>
                        )}
                    </div>

                    {/* Availability */}
                    <div className="filter-section">
                        <label className="filter-switch">
                            <input type="checkbox" />
                            <span>In Stock Only</span>
                        </label>
                    </div>
                </div>

                <div className="filter-actions-mobile">
                    <button className="btn btn-primary" onClick={onClose}>Apply Filters</button>
                </div>
            </aside>
        </>
    );
};

export default Filters;
