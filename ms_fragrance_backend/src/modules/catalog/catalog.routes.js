import express from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { asyncHandler } from '../../shared/middleware/async-handler.js';

function createCatalogRouter(controller) {
    const router = express.Router();

    // Public endpoints - for Shop facet data
    router.get('/brands', asyncHandler(controller.getBrands));
    router.get('/categories', asyncHandler(controller.getCategories));

    // Admin endpoints - require authentication
    router.post('/brands', authenticate, asyncHandler(controller.createBrand));
    router.put('/brands/:id', authenticate, asyncHandler(controller.updateBrand));
    router.delete('/brands/:id', authenticate, asyncHandler(controller.deleteBrand));

    router.post('/categories', authenticate, asyncHandler(controller.createCategory));
    router.put('/categories/:id', authenticate, asyncHandler(controller.updateCategory));
    router.delete('/categories/:id', authenticate, asyncHandler(controller.deleteCategory));

    return router;
}

export {
  createCatalogRouter
};
