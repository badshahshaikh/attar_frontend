const FRAGRANCE_FAMILIES = ['Oud', 'Musk', 'Amber', 'Shamama', 'Floral', 'French', 'Khas', 'Dehn Al Oud'];
const BRANDS = ['MS Fragrance Exclusive', 'Inspire Fragrances', 'Surrati', 'Anfar', 'SMD Ayyub MD Yaqub', 'Al Haramain', 'Swiss Arabian', 'Nemat', 'SH Kelkar'];
const PRODUCT_COLUMNS = `
    id, name, category, fragrance_type, description, full_description,
    rating, reviews, price, original_price, size_pricing, sizes,
    top_notes, heart_notes, base_notes, longevity, in_stock, is_new,
    brand, is_best_seller, is_exclusive, featured, stock_quantity, slug,
    image_url, created_at, updated_at
`;
const PRODUCT_WRITE_COLUMNS = [
    'name', 'category', 'fragrance_type', 'description', 'full_description',
    'rating', 'reviews', 'price', 'original_price', 'size_pricing', 'sizes',
    'top_notes', 'heart_notes', 'base_notes', 'longevity', 'in_stock', 'is_new',
    'brand', 'is_best_seller', 'is_exclusive', 'featured', 'stock_quantity',
    'slug', 'image_url',
];

module.exports = { FRAGRANCE_FAMILIES, BRANDS, PRODUCT_COLUMNS, PRODUCT_WRITE_COLUMNS };
