import React from 'react';
import { DEFAULT_MIN_PRICE, DEFAULT_MAX_PRICE } from '../../config/constants';

/**
 * PriceRangeFilter
 *
 * Dual-thumb price range slider.
 * Does NOT know about API calls, URL params, or ProductContext.
 * Receives current values and calls back on change.
 *
 * Props:
 *   min       {number}   - Current minimum price.
 *   max       {number}   - Current maximum price.
 *   onChange  {function} - Called as onChange('minPrice'|'maxPrice', number).
 */
const PriceRangeFilter = ({
    min = DEFAULT_MIN_PRICE,
    max = DEFAULT_MAX_PRICE,
    onChange
}) => {
    return (
        <div className="filter-options price-filter">
            <div className="price-values">
                <span>₹{min}</span>
                <span>₹{max}</span>
            </div>

            <div className="price-slider-container">
                <div className="price-slider-track" />

                <div
                    className="price-slider-range"
                    style={{
                        left: `${(min / DEFAULT_MAX_PRICE) * 100}%`,
                        right: `${100 - (max / DEFAULT_MAX_PRICE) * 100}%`
                    }}
                />

                <input
                    type="range"
                    min={DEFAULT_MIN_PRICE}
                    max={DEFAULT_MAX_PRICE}
                    step="50"
                    value={min}
                    onChange={e => onChange('minPrice', Number(e.target.value))}
                    className="price-range-input price-range-min"
                />

                <input
                    type="range"
                    min={DEFAULT_MIN_PRICE}
                    max={DEFAULT_MAX_PRICE}
                    step="50"
                    value={max}
                    onChange={e => onChange('maxPrice', Number(e.target.value))}
                    className="price-range-input price-range-max"
                />
            </div>
        </div>
    );
};

export default PriceRangeFilter;
