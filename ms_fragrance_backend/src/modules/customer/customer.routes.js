import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateCustomer, optionalCustomerAuth } from '../../shared/middleware/authenticate.js';
import { asyncHandler } from '../../shared/middleware/async-handler.js';

// Guest checkout is public, so it is rate-limited to blunt abuse/stock-spam.
// Limits are generous enough for genuine shoppers retrying a slow connection.
const guestOrderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: 'Too many orders placed, please try again later' },
});

const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { success: false, message: 'Too many payment requests, please try again later' },
});

function createCustomerRouter(controller) {
    const router = express.Router();

    // Public guest checkout. Registered BEFORE authenticateCustomer so it needs
    // no session; validation + server-side pricing/stock guard the request.
    router.post('/orders/guest', guestOrderLimiter, asyncHandler(controller.createGuestOrder));

    // Online payment (Razorpay) routes registered BEFORE authenticateCustomer with
    // optionalCustomerAuth so guests can initiate and verify payments for guest orders,
    // while authenticated customers continue to have req.customer populated.
    router.post('/orders/:orderNumber/payment', paymentLimiter, optionalCustomerAuth, asyncHandler(controller.createPaymentSession));
    router.post('/orders/:orderNumber/payment/verify', paymentLimiter, optionalCustomerAuth, asyncHandler(controller.verifyPayment));

    // Every other customer route requires a valid storefront session.
    router.use(authenticateCustomer);

    router.get('/addresses', asyncHandler(controller.listAddresses));
    router.post('/addresses', asyncHandler(controller.createAddress));
    router.get('/addresses/:id', asyncHandler(controller.getAddress));
    router.put('/addresses/:id', asyncHandler(controller.updateAddress));
    router.delete('/addresses/:id', asyncHandler(controller.deleteAddress));
    router.post('/addresses/:id/default', asyncHandler(controller.setDefaultAddress));

    router.get('/orders', asyncHandler(controller.listOrders));
    router.post('/orders', asyncHandler(controller.createOrder));
    router.get('/orders/:orderNumber', asyncHandler(controller.getOrder));

    return router;
}

export { createCustomerRouter };