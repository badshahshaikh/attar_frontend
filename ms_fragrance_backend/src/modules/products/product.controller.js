import { parseProductIdParam, parseListQuery } from './product.validator.js';
import { FRAGRANCE_FAMILIES } from './product.constants.js';
import { logger } from '../../shared/logging/logger.js';
import AppError from '../../core/errors/AppError.js';

function createProductController({
    getProductsUseCase,
    getProductByIdUseCase,
    createProductUseCase,
    updateProductUseCase,
    deleteProductUseCase,
    bulkUpsertProductsUseCase,
    uploadProductImageUseCase,
    getBrandsUseCase,
    getCategoriesUseCase,
    aiFillProductUseCase,
    aiGenerateProductImageUseCase
}) {
    return {
        async list(req, res) {
            try {
                const filters = parseListQuery(req.query);
                const result = await getProductsUseCase.execute(filters);
                res.json(result);
            } catch (error) {
                logger.error('[PRODUCT_LIST_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to fetch products';
                res.status(statusCode).json({ error: message });
            }
        },

        async brands(req, res) {
            try {
                const brands = await getBrandsUseCase.execute();
                res.json(brands);
            } catch (error) {
                logger.error('[PRODUCT_BRANDS_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to fetch brands';
                res.status(statusCode).json({ error: message });
            }
        },

        async categories(req, res) {
            try {
                const categories = await getCategoriesUseCase.execute();
                res.json(categories);
            } catch (error) {
                logger.error('[PRODUCT_CATEGORIES_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to fetch categories';
                res.status(statusCode).json({ error: message });
            }
        },

        fragranceFamilies(req, res) {
            res.json(FRAGRANCE_FAMILIES);
        },

        async uploadImage(req, res) {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }
            try {
                const uploaded = await uploadProductImageUseCase.execute(req.file, req.body.productId);
                return res.json({ imageUrl: uploaded.url, filename: uploaded.path });
            } catch (error) {
                logger.error('Supabase image upload failed', { errorMessage: error.message });
                return res.status(502).json({ error: 'Image upload failed' });
            }
        },

        async getById(req, res) {
            const id = parseProductIdParam(req.params.id);
            if (!id) {
                return res.status(400).json({ error: 'Product ID must be a positive integer' });
            }
            try {
                const product = await getProductByIdUseCase.execute(id);
                res.json(product);
            } catch (error) {
                logger.error('[PRODUCT_GET_ERROR]', { productId: id, errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to fetch product';
                res.status(statusCode).json({ error: message });
            }
        },

        async create(req, res) {
            try {
                const product = await createProductUseCase.execute(req.body);
                return res.status(201).json(product);
            } catch (error) {
                logger.error('[PRODUCT_CREATE_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to create product';
                res.status(statusCode).json({ error: message });
            }
        },

        async update(req, res) {
            const id = parseProductIdParam(req.params.id);
            if (!id) {
                return res.status(400).json({ error: 'Product ID must be a positive integer' });
            }
            try {
                logger.info('[PUT_TRACE]', { stage: 'controller_received', productId: id });
                const result = await updateProductUseCase.execute(id, req.body);
                res.json(result.product);
                logger.info('[PRODUCT_UPDATE]', { stage: 'complete', productId: id, imageChanged: result.imageChanged });
            } catch (error) {
                logger.error('[PRODUCT_UPDATE_ERROR]', { productId: id, errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to update product';
                res.status(statusCode).json({ error: message });
            }
        },

        async delete(req, res) {
            const id = parseProductIdParam(req.params.id);
            if (!id) {
                return res.status(400).json({ error: 'Product ID must be a positive integer' });
            }
            try {
                const deleted = await deleteProductUseCase.execute(id);
                res.json({ message: 'Product deleted', id });
            } catch (error) {
                logger.error('[PRODUCT_DELETE_ERROR]', { productId: id, errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to delete product';
                res.status(statusCode).json({ error: message });
            }
        },

        async bulkUpsert(req, res) {
            const { create, update } = req.body;
            if (!Array.isArray(create) && !Array.isArray(update)) {
                return res.status(400).json({ error: '"create" and/or "update" must be arrays' });
            }
            try {
                const result = await bulkUpsertProductsUseCase.execute({
                    create: Array.isArray(create) ? create : [],
                    update: Array.isArray(update) ? update : [],
                });
                if (!result.success) {
                    return res.status(422).json(result);
                }
                return res.status(200).json(result);
            } catch (error) {
                logger.error('[BULK_UPSERT_ERROR]', { errorMessage: error.message });
                return res.status(500).json({ error: 'Failed to save products. No database changes were made.' });
            }
        },
        async aiFill(req, res) {
            try {
                const { name } = req.body;

                if (!name || !name.trim()) {
                    return res.status(400).json({
                        error: 'Product name is required'
                    });
                }

                const product = await aiFillProductUseCase.execute({
                    name: name.trim()
                });

                return res.json({
                    product
                });
            } catch (error) {
                logger.error('[PRODUCT_AI_FILL_ERROR]', {
                    errorMessage: error.message
                });

                const statusCode = error.statusCode || 500;
                const message = error.isOperational
                    ? error.message
                    : 'Failed to generate product information';

                return res.status(statusCode).json({
                    error: message
                });
            }
        },
        async generateProductImage(req, res) {
            try {
                const image = await aiGenerateProductImageUseCase.execute(
                    req.body
                );

                res.json({ image });
            } catch (error) {
                logger.error('[AI_PRODUCT_IMAGE_ERROR]', {
                    errorMessage: error.message
                });

                res.status(500).json({
                    error: 'Failed to generate product image'
                });
            }
        },
    };
}

export {
    createProductController
};
