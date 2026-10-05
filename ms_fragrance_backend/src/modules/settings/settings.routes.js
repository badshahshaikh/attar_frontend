import express from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/middleware/require-role.js';
import { asyncHandler } from '../../shared/middleware/async-handler.js';

function createSettingsRouter(controller) {
    const router = express.Router();
    const requireAdmin = requireRole('admin');

    // Public endpoint - no authentication required
    router.get('/footer', asyncHandler(controller.getFooterSettings));

    // Admin endpoint - authentication and the admin role required
    router.put('/footer', authenticate, requireAdmin, asyncHandler(controller.updateFooterSettings));

    return router;
}

export { createSettingsRouter };