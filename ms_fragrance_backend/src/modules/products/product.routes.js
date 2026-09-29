import express from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { asyncHandler } from '../../shared/middleware/async-handler.js';
import { upload } from './product.upload.js';

function createProductRouter(controller) {
  const router = express.Router();
  router.get('/', asyncHandler(controller.list));
  router.get('/brands', controller.brands);
  router.get('/fragrance-families', controller.fragranceFamilies);
  router.post(
    '/ai-fill',
    authenticate,
    asyncHandler(controller.aiFill)
  );
  router.post('/upload-image', authenticate, upload.single('image'), asyncHandler(controller.uploadImage));
  router.post('/bulk-upsert', authenticate, asyncHandler(controller.bulkUpsert));
  router.get('/:id', asyncHandler(controller.getById));
  router.post('/', authenticate, asyncHandler(controller.create));
  router.put('/:id', authenticate, asyncHandler(controller.update));
  router.delete('/:id', authenticate, asyncHandler(controller.delete));
  return router;
}

export {
  createProductRouter
};
