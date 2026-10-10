import express from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/middleware/require-role.js';
import { asyncHandler } from '../../shared/middleware/async-handler.js';

function createOrdersRouter(controller) {
    const router = express.Router();
    const requireAdmin = requireRole('admin');

    // Admin-only order management
    router.get('/', authenticate, requireAdmin, asyncHandler(controller.list));

    // Status update. Registered before '/:id' so the more specific path is not
    // shadowed by the generic id route. Updates one status field at a time and
    // is gated by the same authenticate + admin role as the other endpoints.
    router.patch('/:id/status', authenticate, requireAdmin, asyncHandler(controller.updateStatus));

    // Invoice PDF. Also registered before '/:id' for the same reason. Streams a
    // real application/pdf download, admin-only, and is read-only.
    router.get('/:id/invoice', authenticate, requireAdmin, asyncHandler(controller.invoice));

    router.get('/:id', authenticate, requireAdmin, asyncHandler(controller.getById));

    return router;
}

export { createOrdersRouter };