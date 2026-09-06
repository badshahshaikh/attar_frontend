const jwt = require('jsonwebtoken');
const { config } = require('../../config/env');

function authenticate(req, res, next) {
    console.log('[AUTH_DEBUG] Request origin:', req.headers.origin);
    console.log('[AUTH_DEBUG] Request cookies keys:', Object.keys(req.cookies || {}));
    console.log('[AUTH_DEBUG] Cookie name expected:', config.auth.cookie.name);
    console.log('[AUTH_DEBUG] Cookie exists:', !!req.cookies[config.auth.cookie.name]);
    
    const token = req.cookies[config.auth.cookie.name];
    if (!token) {
        console.log('[AUTH_DEBUG] 401 - No token found in cookies');
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    try {
        const decoded = jwt.verify(token, config.auth.jwtSecret);
        if (!decoded.id || !decoded.username || !decoded.role) throw new Error('Invalid payload');
        req.user = decoded;
        console.log('[AUTH_DEBUG] Authentication successful for user:', decoded.username);
        return next();
    } catch (error) {
        console.log('[AUTH_DEBUG] 401 - JWT verification failed:', error.message);
        return res.status(401).json({ success: false, message: 'Invalid or expired authentication' });
    }
}

module.exports = { authenticate };
