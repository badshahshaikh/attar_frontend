import React from 'react';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import './Sorting.css';

const Sorting = ({ toggleFilters, sortType, setSortType, totalResults }) => {
    return (
        <div className="sorting-section">
            <button className="mobile-filter-btn" onClick={toggleFilters}>
                <SlidersHorizontal size={18} />
                <span>Filter Products</span>
            </button>

            <div className="results-count">
                Showing {totalResults} {totalResults === 1 ? 'result' : 'results'}
            </div>

            <div className="sort-dropdown">
                <span className="sort-label">Sort by:</span>
                <div className="sort-select-wrapper">
                    <select
                        className="sort-select"
                        value={sortType}
                        onChange={(e) => setSortType(e.target.value)}
                    >
                        <option value="popularity">Popularity</option>
                        <option value="newest">Newest Arrivals</option>
                        <option value="price-low">Price: Low to High</option>
                        <option value="price-high">Price: High to Low</option>
                    </select>
                    <ChevronDown size={14} className="sort-chevron" />
                </div>
            </div>
        </div>
    );
};

export default Sorting;
