import express from 'express';
import { authenticateCustomer } from '../../shared/middleware/authenticate.js';
import { asyncHandler } from '../../shared/middleware/async-handler.js';

function createCustomerRouter(controller) {
    const router = express.Router();

    // Every customer route requires a valid storefront session.
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