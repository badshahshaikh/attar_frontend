const jwt = require('jsonwebtoken');
const { config } = require('../../config/env');

function authenticate(req, res, next) {
    const token = req.cookies[config.auth.cookie.name];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    try {
        const decoded = jwt.verify(token, config.auth.jwtSecret);
        if (!decoded.id || !decoded.username || !decoded.role) throw new Error('Invalid payload');
        req.user = decoded;
        return next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid or expired authentication' });
    }
}

module.exports = { authenticate };
