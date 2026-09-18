import { logger } from '../../shared/logging/logger.js';

function createCatalogRepository({ query }) {
    return {
        // Brand operations
        async getAllBrands() {
            try {
                const result = await query('SELECT id, name, created_at, updated_at FROM brands ORDER BY name ASC');
                return result.rows;
            } catch (error) {
                logger.error('[GET_ALL_BRANDS_ERROR]', { errorMessage: error.message });
                throw error;
            }
        },

        async getBrandById(id) {
            try {
                const result = await query('SELECT id, name, created_at, updated_at FROM brands WHERE id = $1', [id]);
                return result.rows[0] || null;
            } catch (error) {
                logger.error('[GET_BRAND_BY_ID_ERROR]', { brandId: id, errorMessage: error.message });
                throw error;
            }
        },

        async createBrand(name) {
            try {
                const result = await query(
                    'INSERT INTO brands (name) VALUES ($1) RETURNING id, name, created_at, updated_at',
                    [name.trim()]
                );
                return result.rows[0];
            } catch (error) {
                logger.error('[CREATE_BRAND_ERROR]', { errorMessage: error.message });
                throw error;
            }
        },

        async updateBrand(id, name) {
            try {
                const result = await query(
                    'UPDATE brands SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, created_at, updated_at',
                    [name.trim(), id]
                );
                return result.rows[0] || null;
            } catch (error) {
                logger.error('[UPDATE_BRAND_ERROR]', { brandId: id, errorMessage: error.message });
                throw error;
            }
        },

        async deleteBrand(id) {
            try {
                const result = await query('DELETE FROM brands WHERE id = $1 RETURNING id', [id]);
                return result.rows[0] || null;
            } catch (error) {
                logger.error('[DELETE_BRAND_ERROR]', { brandId: id, errorMessage: error.message });
                throw error;
            }
        },

        // Category operations
        async getAllCategories() {
            try {
                const result = await query('SELECT id, name, created_at, updated_at FROM categories ORDER BY name ASC');
                return result.rows;
            } catch (error) {
                logger.error('[GET_ALL_CATEGORIES_ERROR]', { errorMessage: error.message });
                throw error;
            }
        },

        async getCategoryById(id) {
            try {
                const result = await query('SELECT id, name, created_at, updated_at FROM categories WHERE id = $1', [id]);
                return result.rows[0] || null;
            } catch (error) {
                logger.error('[GET_CATEGORY_BY_ID_ERROR]', { categoryId: id, errorMessage: error.message });
                throw error;
            }
        },

        async createCategory(name) {
            try {
                const result = await query(
                    'INSERT INTO categories (name) VALUES ($1) RETURNING id, name, created_at, updated_at',
                    [name.trim()]
                );
                return result.rows[0];
            } catch (error) {
                logger.error('[CREATE_CATEGORY_ERROR]', { errorMessage: error.message });
                throw error;
            }
        },

        async updateCategory(id, name) {
            try {
                const result = await query(
                    'UPDATE categories SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, created_at, updated_at',
                    [name.trim(), id]
                );
                return result.rows[0] || null;
            } catch (error) {
                logger.error('[UPDATE_CATEGORY_ERROR]', { categoryId: id, errorMessage: error.message });
                throw error;
            }
        },

        async deleteCategory(id) {
            try {
                const result = await query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
                return result.rows[0] || null;
            } catch (error) {
                logger.error('[DELETE_CATEGORY_ERROR]', { categoryId: id, errorMessage: error.message });
                throw error;
            }
        }
    };
}

export { createCatalogRepository };
