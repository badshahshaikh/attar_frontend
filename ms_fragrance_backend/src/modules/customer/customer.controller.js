import {
    validateAddressPayload,
    validateAddressUpdate,
    validateCreateOrder,
} from './customer.validator.js';
import { logger } from '../../shared/logging/logger.js';

function parseId(rawId) {
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
}

function createCustomerController({ customerService }) {
    function fail(res, error, fallback) {
        logger.error('[CUSTOMER_REQUEST_ERROR]', {
            errorMessage: error.message,
            code: error.code || null,
        });

        const statusCode = error.statusCode || 500;
        const message = error.isOperational ? error.message : fallback;

        return res.status(statusCode).json({ success: false, message });
    }

    function validated(res, run, fallback) {
        try {
            return run();
        } catch (error) {
            return fail(res, error, fallback);
        }
    }

    return {
        async listAddresses(req, res) {
            try {
                res.json({ success: true, addresses: await customerService.listAddresses(req.customer.id) });
            } catch (error) {
                fail(res, error, 'Unable to load your addresses');
            }
        },

        async getAddress(req, res) {
            const id = parseId(req.params.id);

            if (!id) {
                return res.status(400).json({ success: false, message: 'Address is invalid' });
            }

            try {
                res.json({ success: true, address: await customerService.getAddress(req.customer.id, id) });
            } catch (error) {
                fail(res, error, 'Unable to load that address');
            }
        },

        async createAddress(req, res) {
            const id = await validated(res, () => validateAddressPayload(req.body), 'Unable to save your address');

            if (!id) return undefined;

            try {
                const address = await customerService.createAddress(req.customer.id, id);
                res.status(201).json({ success: true, address });
            } catch (error) {
                return fail(res, error, 'Unable to save your address');
            }
        },

        async updateAddress(req, res) {
            const id = parseId(req.params.id);

            if (!id) {
                return res.status(400).json({ success: false, message: 'Address is invalid' });
            }

            const payload = validated(res, () => validateAddressUpdate(req.body), 'Unable to update your address');

            if (!payload) return undefined;

            try {
                const address = await customerService.updateAddress(req.customer.id, id, payload);
                res.json({ success: true, address });
            } catch (error) {
                return fail(res, error, 'Unable to update your address');
            }
        },

        async setDefaultAddress(req, res) {
            const id = parseId(req.params.id);

            if (!id) {
                return res.status(400).json({ success: false, message: 'Address is invalid' });
            }

            try {
                const addresses = await customerService.setDefaultAddress(req.customer.id, id);
                res.json({ success: true, addresses });
            } catch (error) {
                return fail(res, error, 'Unable to update your default address');
            }
        },

        async deleteAddress(req, res) {
            const id = parseId(req.params.id);

            if (!id) {
                return res.status(400).json({ success: false, message: 'Address is invalid' });
            }

            try {
                const addresses = await customerService.removeAddress(req.customer.id, id);
                res.json({ success: true, addresses });
            } catch (error) {
                return fail(res, error, 'Unable to delete that address');
            }
        },

        async listOrders(req, res) {
            try {
                res.json({ success: true, orders: await customerService.listOrders(req.customer.id) });
            } catch (error) {
                fail(res, error, 'Unable to load your orders');
            }
        },

        async getOrder(req, res) {
            const orderNumber = String(req.params.orderNumber || '').trim();

            if (!orderNumber) {
                return res.status(400).json({ success: false, message: 'Order number is required' });
            }

            try {
                res.json({ success: true, order: await customerService.getOrder(req.customer.id, orderNumber) });
            } catch (error) {
                return fail(res, error, 'Unable to load that order');
            }
        },

        async createOrder(req, res) {
            const payload = validated(res, () => validateCreateOrder(req.body), 'Unable to place your order');

            if (!payload) return undefined;

            try {
                const order = await customerService.createOrder(req.customer.id, payload);
                res.status(201).json({ success: true, order });
            } catch (error) {
                return fail(res, error, 'Unable to place your order');
            }
        },

        async createPaymentSession(req, res) {
            const orderNumber = String(req.params.orderNumber || '').trim();

            if (!orderNumber) {
                return res.status(400).json({ success: false, message: 'Order number is required' });
            }

            try {
                const session = await customerService.createPaymentSession(req.customer.id, orderNumber);
                res.json({ success: true, ...session });
            } catch (error) {
                return fail(res, error, 'Unable to start payment session');
            }
        },

        async verifyPayment(req, res) {
            const orderNumber = String(req.params.orderNumber || '').trim();

            if (!orderNumber) {
                return res.status(400).json({ success: false, message: 'Order number is required' });
            }

            try {
                const order = await customerService.verifyPayment(req.customer.id, {
                    orderNumber,
                    razorpayOrderId: req.body.razorpay_order_id,
                    razorpayPaymentId: req.body.razorpay_payment_id,
                    razorpaySignature: req.body.razorpay_signature,
                });
                res.json({ success: true, order });
            } catch (error) {
                return fail(res, error, 'Payment verification failed');
            }
        },
    };
}

export {
  createCustomerController
};