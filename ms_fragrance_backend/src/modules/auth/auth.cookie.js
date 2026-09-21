import { config } from '../../config/env.js';

function setAuthCookie(res, token) {
    res.cookie(config.auth.cookie.name, token, config.auth.cookie);
}

function clearAuthCookie(res) {
    const cookie = config.auth.cookie;
    res.clearCookie(cookie.name, {
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
    });
}

export { setAuthCookie, clearAuthCookie };
