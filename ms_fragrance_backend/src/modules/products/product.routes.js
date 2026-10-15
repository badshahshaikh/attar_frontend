import express from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/middleware/require-role.js';
import { asyncHandler } from '../../shared/middleware/async-handler.js';
import { upload } from './product.upload.js';

function createProductRouter(controller) {
  const router = express.Router();
  const requireAdmin = requireRole('admin');
  router.get('/', asyncHandler(controller.list));
  router.get('/brands', controller.brands);
  router.get('/fragrance-families', controller.fragranceFamilies);
  router.post(
    '/ai-fill',
    authenticate,
    requireAdmin,
    asyncHandler(controller.aiFill)
  );
  router.post(
    '/ai-image',
    authenticate,
    requireAdmin,
    asyncHandler(controller.generateProductImage)
  );
  router.post('/upload-image', authenticate, requireAdmin, upload.single('image'), asyncHandler(controller.uploadImage));
  router.post('/bulk-upsert', authenticate, requireAdmin, asyncHandler(controller.bulkUpsert));
  router.delete('/bulk', authenticate, requireAdmin, asyncHandler(controller.bulkDelete));
  router.get('/:id', asyncHandler(controller.getById));
  router.post('/', authenticate, requireAdmin, asyncHandler(controller.create));
  router.put('/:id', authenticate, requireAdmin, asyncHandler(controller.update));
  router.delete('/:id', authenticate, requireAdmin, asyncHandler(controller.delete));
  return router;
}

export {
  createProductRouter
};
