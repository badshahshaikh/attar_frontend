import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * FilterSection
 *
 * Collapsible container for a single filter group.
 * Owns its own open/closed state so the parent doesn't need to track it.
 *
 * Props:
 *   title     {string}  - The section heading.
 *   defaultOpen {boolean} - Whether the section starts expanded. Default: true.
 *   children  {ReactNode} - Filter controls to render inside.
 */
const FilterSection = ({ title, defaultOpen = true, children }) => {
    const [isOpen, setIsOpen] = React.useState(defaultOpen);

    return (
        <div className="filter-section">
            <div
                className="filter-section-header"
                onClick={() => setIsOpen(prev => !prev)}
            >
                <h4>{title}</h4>
                <ChevronDown
                    size={16}
                    className={`filter-chevron ${isOpen ? 'open' : ''}`}
                />
            </div>

            {isOpen && (
                <div className="filter-options">
                    {children}
                </div>
            )}
        </div>
    );
};

export default FilterSection;
