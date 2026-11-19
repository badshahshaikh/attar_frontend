import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';

function authenticate(req, res, next) {
    // Support both cookie-based auth (frontend) and Bearer token auth (MCP server, API clients)
    let token = req.cookies[config.auth.cookie.name];

    // Fall back to Authorization: Bearer <token> header if no cookie present
    if (!token) {
        const authHeader = req.headers?.authorization;
        if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7).trim();
        }
    }

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
        // Fall back to static service-key auth for server-to-server calls
        // (e.g., MCP server calling backend APIs). This is not a JWT; it is a
        // shared secret verified by direct comparison.
        if (
            config.auth.backendServiceKey &&
            token === config.auth.backendServiceKey
        ) {
            req.user = {
                id: 'system',
                role: 'admin',
                source: 'service_key',
            };
            return next();
        }
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

/**
 * optionalCustomerAuth - Optional authentication for storefront routes.
 *
 * If a valid customer cookie (or Authorization header) is present, populates
 * req.customer with the decoded customer. If missing or invalid, sets
 * req.customer to null and proceeds without throwing 401 so guest requests can
 * continue.
 */
function optionalCustomerAuth(req, res, next) {
    let token = req.cookies?.[config.auth.customerCookie.name];

    if (!token) {
        const authHeader = req.headers?.authorization;
        if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7).trim();
        }
    }

    if (!token) {
        req.customer = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, config.auth.jwtSecret);
        if (decoded.id && decoded.role === 'customer') {
            req.customer = decoded;
        } else {
            req.customer = null;
        }
        return next();
    } catch {
        req.customer = null;
        return next();
    }
}

export {
  authenticate,
  authenticateCustomer,
  optionalCustomerAuth
};
