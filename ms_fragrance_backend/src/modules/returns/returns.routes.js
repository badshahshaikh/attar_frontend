import express from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/middleware/require-role.js';
import { asyncHandler } from '../../shared/middleware/async-handler.js';

function createReturnsRouter(controller) {
    const router = express.Router();
    const requireAdmin = requireRole('admin');

    // Every returns endpoint is admin-only. More specific paths are registered
    // before '/:id' so they are never shadowed by the generic id route.
    router.get('/', authenticate, requireAdmin, asyncHandler(controller.list));
    router.get('/eligibility', authenticate, requireAdmin, asyncHandler(controller.eligibility));
    router.post('/', authenticate, requireAdmin, asyncHandler(controller.create));
    router.patch('/:id/status', authenticate, requireAdmin, asyncHandler(controller.updateStatus));
    router.post('/:id/refund', authenticate, requireAdmin, asyncHandler(controller.recordRefund));
    router.get('/:id', authenticate, requireAdmin, asyncHandler(controller.getById));

    return router;
}

export { createReturnsRouter };
