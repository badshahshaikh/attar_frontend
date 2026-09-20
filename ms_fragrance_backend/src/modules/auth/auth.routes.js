const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../../shared/middleware/authenticate');
const { asyncHandler } = require('../../shared/middleware/async-handler');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many login attempts, please try again later' },
});

function createAuthRouter(controller) {
    const router = express.Router();
    router.post('/login', loginLimiter, asyncHandler(controller.login));
    router.post('/logout', controller.logout);
    router.get('/me', authenticate, controller.me);
    return router;
}

export { createAuthRouter };
