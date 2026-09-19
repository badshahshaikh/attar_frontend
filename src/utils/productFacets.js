export const getAvailableCategories = (categories = []) => {
    return categories
        .map(category => category.name)
        .sort();
};

export const getAvailableFragranceFamilies = (families = []) => {
    return [...families].sort();
};

export const getAvailableSizes = ({
    facetSizes = [],
    products = [],
    sortSizes,
}) => {
    const sizes = facetSizes.length > 0
        ? facetSizes
        : products.flatMap(product =>
            Array.isArray(product.sizes)
                ? product.sizes
                : []
        );

    return sortSizes(sizes);
};