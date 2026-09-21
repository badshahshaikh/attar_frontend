import express from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { asyncHandler } from '../../shared/middleware/async-handler.js';

function createSettingsRouter(controller) {
    const router = express.Router();

    // Public endpoint - no authentication required
    router.get('/footer', asyncHandler(controller.getFooterSettings));

    // Admin endpoint - authentication required
    router.put('/footer', authenticate, asyncHandler(controller.updateFooterSettings));

    return router;
}

export { createSettingsRouter };