import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authenticateCustomer } from '../../shared/middleware/authenticate.js';
import { asyncHandler } from '../../shared/middleware/async-handler.js';

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many login attempts, please try again later' },
});

const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: 'Too many registration attempts, please try again later' },
});

function createAuthRouter(controller) {
    const router = express.Router();

    // ── Admin portal ──────────────────────────────────────────────────────
    router.post('/login', loginLimiter, asyncHandler(controller.login));
    router.post('/logout', controller.logout);
    router.get('/me', authenticate, controller.me);

    // ── Customer storefront ───────────────────────────────────────────────
    router.post('/customer/register', registerLimiter, asyncHandler(controller.customerRegister));
    router.post('/customer/login', loginLimiter, asyncHandler(controller.customerLogin));
    router.post('/customer/logout', asyncHandler(controller.customerLogout));
    router.get('/customer/me', authenticateCustomer, asyncHandler(controller.customerMe));
    router.put('/customer/me', authenticateCustomer, asyncHandler(controller.updateCustomerProfile));
    router.post(
        '/customer/me/password',
        authenticateCustomer,
        asyncHandler(controller.changeCustomerPassword)
    );

    return router;
}

export { createAuthRouter };
