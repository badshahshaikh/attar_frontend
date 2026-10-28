import express from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/middleware/require-role.js';
import { asyncHandler } from '../../shared/middleware/async-handler.js';

function createSeoRouter(controller) {
    const router = express.Router();
    const requireAdmin = requireRole('admin');

    // ── Public: sitemap ───────────────────────────────────────────────
    router.get('/public/sitemap', asyncHandler(controller.getSitemap));

    // ── Public: SEO metadata for a published public route ─────────────
    router.get('/public/:route', asyncHandler(controller.getPublicSeo));

    // ── Admin: SEO management (authentication + admin role) ───────────
    router.get('/', authenticate, requireAdmin, asyncHandler(controller.listSeoSettings));
    router.post('/', authenticate, requireAdmin, asyncHandler(controller.createSeoSetting));
    router.get('/:route', authenticate, requireAdmin, asyncHandler(controller.getSeoSetting));
    router.put('/:route', authenticate, requireAdmin, asyncHandler(controller.updateSeoSetting));
    router.delete('/:route', authenticate, requireAdmin, asyncHandler(controller.deleteSeoSetting));

    return router;
}

export { createSeoRouter };
