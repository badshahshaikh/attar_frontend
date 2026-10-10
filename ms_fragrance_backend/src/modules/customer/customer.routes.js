import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateCustomer } from '../../shared/middleware/authenticate.js';
import { asyncHandler } from '../../shared/middleware/async-handler.js';

// Guest checkout is public, so it is rate-limited to blunt abuse/stock-spam.
// Limits are generous enough for genuine shoppers retrying a slow connection.
const guestOrderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: 'Too many orders placed, please try again later' },
});

function createCustomerRouter(controller) {
    const router = express.Router();

    // Public guest checkout. Registered BEFORE authenticateCustomer so it needs
    // no session; validation + server-side pricing/stock guard the request.
    router.post('/orders/guest', guestOrderLimiter, asyncHandler(controller.createGuestOrder));

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

    // Online payment (Razorpay)
    router.post('/orders/:orderNumber/payment', asyncHandler(controller.createPaymentSession));
    router.post('/orders/:orderNumber/payment/verify', asyncHandler(controller.verifyPayment));

    return router;
}

export { createCustomerRouter };