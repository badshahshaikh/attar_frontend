const { validateLogin } = require('./auth.validator');
const { setAuthCookie, clearAuthCookie } = require('./auth.cookie');
const { logger } = require('../../shared/logging/logger');

function createAuthController({ authService }) {
    return {
        async login(req, res) {
            let credentials;
            try {
                credentials = validateLogin(req.body);
            } catch (error) {
                return res.status(400).json({ success: false, message: error.message });
            }
            try {
                const result = await authService.login(credentials);
                if (!result) return res.status(401).json({ success: false, message: 'Invalid username/email or password' });
                setAuthCookie(res, result.token);
                return res.json({ success: true, user: result.payload });
            } catch (error) {
                logger.error('Login error:', { errorMessage: error.message });
                return res.status(500).json({ success: false, message: 'Internal server error' });
            }
        },
        logout(req, res) {
            clearAuthCookie(res);
            res.json({ success: true, message: 'Logged out successfully' });
        },
        me(req, res) { res.json({ authenticated: true, user: req.user }); },
    };
}

module.exports = { createAuthController };
