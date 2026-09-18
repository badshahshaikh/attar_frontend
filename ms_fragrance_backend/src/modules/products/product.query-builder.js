
import { QueryBuilder } from '../../shared/database/query-builder.js';

export function buildProductWhere(filters) {
    const builder = new QueryBuilder();

    // Search
    builder.addSearch(
        [
            'name',
            'description',
            'brand',
            'fragrance_type',
            'category'
        ],
        filters.search
    );

    // Single-value brand filter
    if (filters.brand) {
        builder.add('brand = ?', String(filters.brand));
    }

    // Multi-select filters
    builder.addIn('category', filters.categories);
    builder.addIn('brand', filters.brands);
    builder.addIn('fragrance_type', filters.fragranceFamily);

    // Boolean filters
    builder.addBoolean('is_best_seller', filters.isBestSeller);
    builder.addBoolean('is_exclusive', filters.isExclusive);
    builder.addBoolean('featured', filters.featured);

    // In-stock-only
    if (filters.inStockOnly === true) {
        builder.addRaw('in_stock = TRUE');
    }

    // Price range
    builder.addRange(
        'price',
        filters.minPrice,
        filters.maxPrice
    );

    // Sizes stored as PostgreSQL JSONB array
    if (filters.sizes?.length) {
        builder.addJsonbArrayOverlap('sizes', filters.sizes);
    }

    return builder.build();
}