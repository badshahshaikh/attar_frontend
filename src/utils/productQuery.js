export const buildProductQuery = ({
    page = 1,
    limit = 12,
    search = '',
    categories = [],
    sizes = [],
    minPrice = 0,
    maxPrice = 10000,
    inStockOnly = false,
    brand = '',
    category = '',
}) => {
    const params = new URLSearchParams();

    params.set('page', String(page));
    params.set('limit', String(limit));
    params.set('minPrice', String(minPrice));
    params.set('maxPrice', String(maxPrice));
    params.set('inStockOnly', String(inStockOnly));

    if (search) params.set('search', search);
    if (brand) params.set('brand', brand);
    if (category) params.set('category', category);

    categories.forEach(value => {
        params.append('categories', value);
    });

    sizes.forEach(value => {
        params.append('sizes', value);
    });

    return params.toString();
};