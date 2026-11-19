import {
    validateAddressPayload,
    validateAddressUpdate,
    validateCreateOrder,
    validateGuestOrder,
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
            // [FIXED] Send error response and return null to prevent passing Express response object downstream
            fail(res, error, fallback);
            return null;
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

        // Public guest checkout — no session required. The order is recorded
        // with a null user_id and the delivery details supplied on the form.
        // Everything is validated and re-priced server-side exactly like a
        // signed-in order; only the auth layer is skipped.
        async createGuestOrder(req, res) {
            const payload = validated(res, () => validateGuestOrder(req.body), 'Unable to place your order');

            if (!payload) return undefined;

            try {
                const order = await customerService.createGuestOrder(payload);
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
                const customerId = req.customer?.id || null;
                const contactPhone = req.body?.contactPhone || req.body?.phone || req.query?.phone;
                const contactEmail = req.body?.contactEmail || req.body?.email || req.query?.email;
                const session = await customerService.createPaymentSession(customerId, orderNumber, {
                    contactPhone,
                    contactEmail,
                });
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
                const customerId = req.customer?.id || null;
                const contactPhone = req.body?.contactPhone || req.body?.phone;
                const contactEmail = req.body?.contactEmail || req.body?.email;
                const order = await customerService.verifyPayment(customerId, {
                    orderNumber,
                    razorpayOrderId: req.body?.razorpay_order_id,
                    razorpayPaymentId: req.body?.razorpay_payment_id,
                    razorpaySignature: req.body?.razorpay_signature,
                    contactPhone,
                    contactEmail,
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