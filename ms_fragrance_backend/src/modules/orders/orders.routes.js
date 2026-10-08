import express from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/middleware/require-role.js';
import { asyncHandler } from '../../shared/middleware/async-handler.js';

function createOrdersRouter(controller) {
    const router = express.Router();
    const requireAdmin = requireRole('admin');

    // Admin-only order management
    router.get('/', authenticate, requireAdmin, asyncHandler(controller.list));
    router.get('/:id', authenticate, requireAdmin, asyncHandler(controller.getById));

    return router;
}

export { createOrdersRouter };