/**
 * productConstants.js - Product-related constants
 * 
 * Centralized constants to avoid duplication across components.
 */

export const SIZE_KEYS = ['3ml', '6ml', '12ml', '50ml', '100ml'];
export const FRAGRANCE_FAMILIES = ['Oud', 'Musk', 'Amber', 'Shamama', 'Floral', 'French', 'Khas', 'Dehn Al Oud'];
export const CATEGORIES = ['Attar', 'Perfume', 'Essential Oil', 'Other'];
export const IMPORT_HEADERS = ['name', 'brand', 'fragranceType', '3ml', '6ml', '12ml', '50ml', '100ml'];

export const EMPTY_PRODUCT = {
    name: '',
    category: 'Attar',
    fragranceType: '',
    brand: '',
    price: '',
    originalPrice: '',
    stockQuantity: 0,
    longevity: '',
    rating: 0,
    reviews: 0,
    sizes: '',
    sizePricing: '{}',
    topNotes: '',
    heartNotes: '',
    baseNotes: '',
    description: '',
    fullDescription: '',
    inStock: true,
    isNew: false,
    isBestSeller: false,
    isExclusive: false,
    featured: false,
    imageUrl: ''
};
