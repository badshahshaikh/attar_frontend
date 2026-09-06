const { config } = require('../../config/env');

function setAuthCookie(res, token) {
    console.log('[AUTH_COOKIE_DEBUG] Setting cookie with name:', config.auth.cookie.name);
    console.log('[AUTH_COOKIE_DEBUG] Cookie options:', {
        httpOnly: config.auth.cookie.httpOnly,
        secure: config.auth.cookie.secure,
        sameSite: config.auth.cookie.sameSite,
        maxAge: config.auth.cookie.maxAge,
    });
    res.cookie(config.auth.cookie.name, token, config.auth.cookie);
    console.log('[AUTH_COOKIE_DEBUG] Cookie set on response');
}

function clearAuthCookie(res) {
    const cookie = config.auth.cookie;
    console.log('[AUTH_COOKIE_DEBUG] Clearing cookie:', cookie.name);
    res.clearCookie(cookie.name, {
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
    });
}

module.exports = { setAuthCookie, clearAuthCookie };
