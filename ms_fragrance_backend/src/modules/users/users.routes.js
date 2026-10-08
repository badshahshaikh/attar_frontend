import express from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/middleware/require-role.js';
import { asyncHandler } from '../../shared/middleware/async-handler.js';

function createUsersRouter(controller) {
    const router = express.Router();
    const requireAdmin = requireRole('admin');

    // Admin-only: list registered customers
    router.get('/', authenticate, requireAdmin, asyncHandler(controller.list));

    return router;
}

export { createUsersRouter };