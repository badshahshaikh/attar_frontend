const express = require('express');
const { authenticate } = require('../../shared/middleware/authenticate');
const { asyncHandler } = require('../../shared/middleware/async-handler');

function createSettingsRouter(controller) {
    const router = express.Router();

    // Public endpoint - no authentication required
    router.get('/footer', asyncHandler(controller.getFooterSettings));

    // Admin endpoint - authentication required
    router.put('/footer', authenticate, asyncHandler(controller.updateFooterSettings));

    return router;
}

export { createSettingsRouter };