const express = require('express');
const { authenticate } = require('../../shared/middleware/authenticate');
const { asyncHandler } = require('../../shared/middleware/async-handler');
const { upload } = require('./product.upload');

function createProductRouter(controller) {
    const router = express.Router();
    router.get('/', asyncHandler(controller.list));
    router.get('/brands', controller.brands);
    router.get('/fragrance-families', controller.fragranceFamilies);
    router.post('/upload-image', authenticate, upload.single('image'), asyncHandler(controller.uploadImage));
    router.post('/bulk-upsert', authenticate, asyncHandler(controller.bulkUpsert));
    router.get('/:id', asyncHandler(controller.getById));
    router.post('/', authenticate, asyncHandler(controller.create));
    router.put('/:id', authenticate, asyncHandler(controller.update));
    router.delete('/:id', authenticate, asyncHandler(controller.delete));
    return router;
}

module.exports = { createProductRouter };
