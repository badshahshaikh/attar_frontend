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

function setCustomerCookie(res, token) {
    res.cookie(config.auth.customerCookie.name, token, config.auth.customerCookie);
}

function clearCustomerCookie(res) {
    const cookie = config.auth.customerCookie;
    res.clearCookie(cookie.name, {
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
    });
}

export {
  setAuthCookie,
  clearAuthCookie,
  setCustomerCookie,
  clearCustomerCookie
};
