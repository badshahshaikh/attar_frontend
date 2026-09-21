import { logger } from '../../shared/logging/logger.js';

function createCatalogController({
    getBrandsUseCase,
    createBrandUseCase,
    updateBrandUseCase,
    deleteBrandUseCase,
    getCategoriesUseCase,
    createCategoryUseCase,
    updateCategoryUseCase,
    deleteCategoryUseCase
}) {
    return {
        // Brand endpoints
        async getBrands(req, res) {
            try {
                const brands = await getBrandsUseCase.execute();
                res.json(brands);
            } catch (error) {
                logger.error('[GET_BRANDS_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to fetch brands';
                res.status(statusCode).json({ error: message });
            }
        },

        async createBrand(req, res) {
            try {
                const { name } = req.body;
                const brand = await createBrandUseCase.execute(name);
                res.status(201).json(brand);
            } catch (error) {
                logger.error('[CREATE_BRAND_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to create brand';
                res.status(statusCode).json({ error: message });
            }
        },

        async updateBrand(req, res) {
            try {
                const { id } = req.params;
                const { name } = req.body;
                const brand = await updateBrandUseCase.execute(Number(id), name);
                res.json(brand);
            } catch (error) {
                logger.error('[UPDATE_BRAND_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to update brand';
                res.status(statusCode).json({ error: message });
            }
        },

        async deleteBrand(req, res) {
            try {
                const { id } = req.params;
                const deleted = await deleteBrandUseCase.execute(Number(id));
                res.json({ message: 'Brand deleted', id: deleted.id });
            } catch (error) {
                logger.error('[DELETE_BRAND_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to delete brand';
                res.status(statusCode).json({ error: message });
            }
        },

        // Category endpoints
        async getCategories(req, res) {
            try {
                const categories = await getCategoriesUseCase.execute();
                res.json(categories);
            } catch (error) {
                logger.error('[GET_CATEGORIES_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to fetch categories';
                res.status(statusCode).json({ error: message });
            }
        },

        async createCategory(req, res) {
            try {
                const { name } = req.body;
                const category = await createCategoryUseCase.execute(name);
                res.status(201).json(category);
            } catch (error) {
                logger.error('[CREATE_CATEGORY_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to create category';
                res.status(statusCode).json({ error: message });
            }
        },

        async updateCategory(req, res) {
            try {
                const { id } = req.params;
                const { name } = req.body;
                const category = await updateCategoryUseCase.execute(Number(id), name);
                res.json(category);
            } catch (error) {
                logger.error('[UPDATE_CATEGORY_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to update category';
                res.status(statusCode).json({ error: message });
            }
        },

        async deleteCategory(req, res) {
            try {
                const { id } = req.params;
                const deleted = await deleteCategoryUseCase.execute(Number(id));
                res.json({ message: 'Category deleted', id: deleted.id });
            } catch (error) {
                logger.error('[DELETE_CATEGORY_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to delete category';
                res.status(statusCode).json({ error: message });
            }
        }
    };
}

export {
  createCatalogController
};
