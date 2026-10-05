import express from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/middleware/require-role.js';
import { asyncHandler } from '../../shared/middleware/async-handler.js';

function createCatalogRouter(controller) {
    const router = express.Router();
    const requireAdmin = requireRole('admin');

    // Public endpoints - for Shop facet data
    router.get('/brands', asyncHandler(controller.getBrands));
    router.get('/categories', asyncHandler(controller.getCategories));

    // Admin endpoints - require authentication and the admin role
    router.post('/brands', authenticate, requireAdmin, asyncHandler(controller.createBrand));
    router.put('/brands/:id', authenticate, requireAdmin, asyncHandler(controller.updateBrand));
    router.delete('/brands/:id', authenticate, requireAdmin, asyncHandler(controller.deleteBrand));

    router.post('/categories', authenticate, requireAdmin, asyncHandler(controller.createCategory));
    router.put('/categories/:id', authenticate, requireAdmin, asyncHandler(controller.updateCategory));
    router.delete('/categories/:id', authenticate, requireAdmin, asyncHandler(controller.deleteCategory));

    return router;
}

export {
  createCatalogRouter
};
