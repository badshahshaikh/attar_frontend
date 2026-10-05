import { logger } from '../logging/logger.js';

/**
 * requireRole - Authorization middleware
 *
 * Must be chained AFTER `authenticate`, which populates `req.user`.
 * Responds 403 when the authenticated user does not hold an allowed role.
 *
 * Usage: router.post('/', authenticate, requireRole('admin'), handler)
 */
function requireRole(...allowedRoles) {
    const allowed = new Set(allowedRoles);

    return (req, res, next) => {
        // No req.user means `authenticate` did not run or rejected the request.
        // Fail closed rather than trusting the role check alone.
        if (!req.user || !allowed.has(req.user.role)) {
            logger.warn('[FORBIDDEN]', {
                method: req.method,
                path: req.originalUrl,
                userId: req.user ? req.user.id : null,
                role: req.user ? req.user.role : null,
                allowedRoles: [...allowed],
            });

            return res.status(403).json({
                success: false,
                message: 'You do not have permission to perform this action',
            });
        }

        return next();
    };
}

export {
  requireRole
};