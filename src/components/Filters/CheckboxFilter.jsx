import React from 'react';

/**
 * CheckboxFilter
 *
 * Renders a list of labeled checkboxes for any multi-select filter.
 * Reusable for: Fragrance Profile, Brand, Size, Gender, Occasion, etc.
 *
 * Props:
 *   options  {string[]}  - All available option values.
 *   selected {string[]}  - Currently selected values.
 *   onChange {function}  - Called with the toggled value.
 */
const CheckboxFilter = ({ options, selected, onChange }) => {
    if (!options || options.length === 0) return null;

    return (
        <>
            {options.map(option => (
                <label key={option} className="filter-checkbox">
                    <input
                        type="checkbox"
                        checked={selected.includes(option)}
                        onChange={() => onChange(option)}
                    />
                    <span>{option}</span>
                </label>
            ))}
        </>
    );
};

export default CheckboxFilter;
