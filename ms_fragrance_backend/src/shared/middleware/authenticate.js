import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';

function authenticate(req, res, next) {
    const token = req.cookies[config.auth.cookie.name];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    try {
        const decoded = jwt.verify(token, config.auth.jwtSecret);
        // Only identity and role are required. `username` is admin-specific and
        // must not be required for customer accounts.
        if (!decoded.id || !decoded.role) throw new Error('Invalid payload');
        req.user = decoded;
        return next();
    } catch {
        return res.status(401).json({ success: false, message: 'Invalid or expired authentication' });
    }
}

/**
 * authenticateCustomer - Guards storefront customer routes.
 *
 * Reads the separate customer cookie so a storefront session can never
 * authenticate an admin request, and vice versa.
 */
function authenticateCustomer(req, res, next) {
    const token = req.cookies[config.auth.customerCookie.name];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Please sign in to continue' });
    }
    try {
        const decoded = jwt.verify(token, config.auth.jwtSecret);
        if (!decoded.id || decoded.role !== 'customer') throw new Error('Invalid payload');
        req.customer = decoded;
        return next();
    } catch {
        return res.status(401).json({ success: false, message: 'Your session has expired. Please sign in again.' });
    }
}

export {
  authenticate,
  authenticateCustomer
};
