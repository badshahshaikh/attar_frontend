/**
 * productValidator.js - Validation utilities for product data
 * 
 * Pure functions for validating product data.
 * Reusable and testable without dependencies.
 */

/**
 * Validate product row for bulk operations
 * @param {Object} row - Product row data
 * @returns {Array} Array of error messages (empty if valid)
 */
export function validateProductRow(row) {
    const errors = [];

    if (!row.name || !String(row.name).trim()) {
        errors.push('Product name required');
    }

    if (!row.brand || !String(row.brand).trim()) {
        errors.push('Brand required');
    }

    if (!row.fragranceType || !String(row.fragranceType).trim()) {
        errors.push('Fragrance family required');
    }

    // Validate rating
    if (row.rating !== '' && row.rating !== undefined) {
        const r = parseFloat(row.rating);
        if (isNaN(r) || r < 0 || r > 5) {
            errors.push('Rating must be between 0 and 5');
        }
    }

    // Validate stock quantity
    if (row.stockQuantity !== '' && row.stockQuantity !== undefined) {
        const q = parseInt(row.stockQuantity, 10);
        if (!Number.isInteger(q) || q < 0) {
            errors.push('Stock quantity must be a non-negative integer');
        }
    }

    // Validate size pricing or main price
    const hasSizePrice = Object.keys(row.sizePricing || {}).length > 0;
    const manualPrice = row.price !== '' && row.price !== undefined ? parseFloat(row.price) : NaN;

    if (!hasSizePrice && isNaN(manualPrice)) {
        errors.push('At least one size price or a main price is required');
    }

    if (!hasSizePrice && !isNaN(manualPrice) && manualPrice < 0) {
        errors.push('Price must be ≥ 0');
    }

    return errors;
}

/**
 * Validate product form data
 * @param {Object} values - Form values
 * @returns {Object} Validation result with errors and isValid
 */
export function validateProductForm(values) {
    const errors = {};

    if (!values.name || !String(values.name).trim()) {
        errors.name = 'Product name is required';
    }

    if (!values.brand || !String(values.brand).trim()) {
        errors.brand = 'Brand is required';
    }

    if (!values.fragranceType || !String(values.fragranceType).trim()) {
        errors.fragranceType = 'Fragrance family is required';
    }

    if (values.price === '' || isNaN(parseFloat(values.price)) || parseFloat(values.price) < 0) {
        errors.price = 'Price must be a non-negative number';
    }

    // Validate size pricing JSON
    if (values.sizePricing) {
        if (!Array.isArray(values.sizePricing)) {
            errors.sizePricing = 'Size pricing must be a valid list';
        } else {
            const invalidItem = values.sizePricing.some((item) => {
                const size = Number(item?.size);
                const price = Number(item?.price);

                return (
                    !Number.isFinite(size) ||
                    size <= 0 ||
                    !Number.isFinite(price) ||
                    price < 0
                );
            });

            if (invalidItem) {
                errors.sizePricing =
                    'Each size must be a valid number and each price must be zero or greater';
            }
        }
    }
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}
