import AppError from '../../core/errors/AppError.js';
import { logger } from '../../shared/logging/logger.js';
import { toCamelAddress, toCamelOrder } from './customer.mapper.js';
import { createRazorpayClient, rupeesToPaise, verifyCheckoutSignature } from './razorpay.client.js';

// Mirrors the storefront checkout rule: free over 5000, otherwise a flat 150.
const FREE_SHIPPING_THRESHOLD = 5000;
const FLAT_SHIPPING_CHARGE = 150;
const ORDER_NUMBER_ATTEMPTS = 5;
const UNIQUE_VIOLATION = '23505';

function pad(value) {
    return String(value).padStart(2, '0');
}

function buildOrderNumber(date = new Date()) {
    const stamp = [
        String(date.getFullYear()).slice(-2),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
    ].join('');
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, 'X');

    return `MSF-${stamp}-${suffix}`;
}

function createCustomerService({ addressRepository, orderRepository, razorpayKeyId, razorpayKeySecret }) {
    // Key material is injected by the container; when it is missing the client
    // refuses to create orders (503 PAYMENTS_DISABLED) instead of failing
    // halfway through a checkout.
    const razorpay = createRazorpayClient({ keyId: razorpayKeyId, keySecret: razorpayKeySecret });

    // Pricing always comes from the products table so a tampered client payload
    // cannot change what a customer is charged.
    function priceForSize(product, size) {
        const pricing = product.size_pricing && typeof product.size_pricing === 'object'
            ? product.size_pricing
            : {};

        const candidate = pricing[size] !== undefined ? pricing[size] : product.price;
        const price = Number(candidate);

        if (!Number.isFinite(price) || price < 0) {
            throw new AppError(`"${product.name}" is not available in size ${size}`, 400, 'ITEM_UNAVAILABLE');
        }

        return price;
    }

    function buildLines(items, products) {
        const byId = new Map(products.map((product) => [Number(product.id), product]));

        return items.map((item) => {
            const product = byId.get(item.productId);

            if (!product) {
                throw new AppError('One of the products in your cart no longer exists', 400, 'PRODUCT_MISSING');
            }

            const unitPrice = priceForSize(product, item.size);

            return {
                productId: item.productId,
                productName: product.name,
                size: item.size,
                quantity: item.quantity,
                unitPrice,
                lineTotal: Number((unitPrice * item.quantity).toFixed(2)),
            };
        });
    }

    async function resolveAddress(userId, { addressId, contactName, contactPhone }) {
        if (addressId) {
            const address = await addressRepository.findById(userId, addressId);

            if (!address) {
                throw new AppError('That saved address no longer exists', 404, 'ADDRESS_NOT_FOUND');
            }

            return {
                fullName: address.full_name,
                phone: address.phone,
                line1: address.line1,
                line2: address.line2,
                city: address.city,
                state: address.state,
                postalCode: address.postal_code,
                country: address.country,
            };
        }

        if (!contactName || !contactPhone) {
            throw new AppError('Add a saved address or provide contact details', 400, 'CONTACT_REQUIRED');
        }

        return { fullName: contactName, phone: contactPhone };
    }

    // Loads an order that belongs to this customer, or 404s exactly like the
    // GET /orders/:orderNumber handler does.
    async function loadOrder(userId, orderNumber) {
        const order = await orderRepository.findByOrderNumber(userId, orderNumber);

        if (!order) {
            throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
        }

        return order;
    }

    // Webhook lookup + validation: the order must exist for the Razorpay order
    // id we stored when the payment session was created, and the captured
    // amount (paise) must equal the server-side total (rupees), so a forged
    // webhook can never flip an order to paid.
    async function resolveWebhookOrder({ razorpayOrderId, amountPaise }) {
        const order = await orderRepository.findByRazorpayOrderId(razorpayOrderId);

        if (!order) {
            throw new AppError('Payment does not match any order', 404, 'ORDER_NOT_FOUND');
        }

        if (rupeesToPaise(order.total) !== Number(amountPaise)) {
            throw new AppError('Payment amount does not match the order total', 400, 'PAYMENT_AMOUNT_MISMATCH');
        }

        return order;
    }

    return {
        async listAddresses(userId) {
            const rows = await addressRepository.list(userId);
            return rows.map(toCamelAddress);
        },

        async getAddress(userId, addressId) {
            const address = await addressRepository.findById(userId, addressId);

            if (!address) {
                throw new AppError('Address not found', 404, 'ADDRESS_NOT_FOUND');
            }

            return toCamelAddress(address);
        },

        async createAddress(userId, payload) {
            const address = await addressRepository.create(userId, payload);
            return toCamelAddress(address);
        },

        async updateAddress(userId, addressId, payload) {
            const updated = await addressRepository.update(userId, addressId, payload);

            if (!updated) {
                throw new AppError('Address not found', 404, 'ADDRESS_NOT_FOUND');
            }

            return toCamelAddress(updated);
        },

        async setDefaultAddress(userId, addressId) {
            const result = await addressRepository.setDefault(userId, addressId);

            if (!result) {
                throw new AppError('Address not found', 404, 'ADDRESS_NOT_FOUND');
            }

            const rows = await addressRepository.list(userId);
            return rows.map(toCamelAddress);
        },

        async removeAddress(userId, addressId) {
            const removed = await addressRepository.remove(userId, addressId);

            if (!removed) {
                throw new AppError('Address not found', 404, 'ADDRESS_NOT_FOUND');
            }

            const rows = await addressRepository.list(userId);
            return rows.map(toCamelAddress);
        },

        async listOrders(userId) {
            const rows = await orderRepository.list(userId);
            return rows.map(toCamelOrder);
        },

        async getOrder(userId, orderNumber) {
            const order = await orderRepository.findByOrderNumber(userId, orderNumber);

            if (!order) {
                throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
            }

            return toCamelOrder(order);
        },

        async createOrder(userId, payload) {
            const products = await orderRepository.findProductsByIds(
                [...new Set(payload.items.map((item) => item.productId))]
            );

            const lines = buildLines(payload.items, products);
            const subtotal = Number(
                lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2)
            );
            const shipping = subtotal > FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_CHARGE;
            const total = Number((subtotal + shipping).toFixed(2));
            const address = await resolveAddress(userId, payload);

            // order_number is unique, so retry on the rare collision.
            for (let attempt = 0; attempt < ORDER_NUMBER_ATTEMPTS; attempt += 1) {
                try {
                    const order = await orderRepository.create(userId, {
                        orderNumber: buildOrderNumber(),
                        address,
                        contactName: payload.contactName || address.fullName,
                        contactPhone: payload.contactPhone || address.phone,
                        notes: payload.notes,
                        source: payload.source,
                        lines,
                        subtotal,
                        shipping,
                        total,
                    });

                    return toCamelOrder(order);
                } catch (error) {
                    const isCollision = error.code === UNIQUE_VIOLATION && attempt < ORDER_NUMBER_ATTEMPTS - 1;

                    if (!isCollision) {
                        logger.error('[CUSTOMER_ORDER_CREATE_FAILED]', {
                            userId,
                            errorMessage: error.message,
                        });
                        throw error;
                    }
                }
            }

            throw new AppError('Unable to create your order right now', 500, 'ORDER_FAILED');
        },

        async createPaymentSession(userId, orderNumber) {
            const order = await loadOrder(userId, orderNumber);

            if (order.payment_status === 'paid') {
                throw new AppError('This order has already been paid', 400, 'ORDER_ALREADY_PAID');
            }

            // Razorpay speaks paise; the orders table stores rupees.
            const amountPaise = rupeesToPaise(order.total);

            const razorpayOrder = await razorpay.createOrder({
                amountPaise,
                receipt: order.order_number,
            });

            // Record which Razorpay order belongs to our order so the verify
            // endpoint and webhooks can match the payment back to it.
            const linked = await orderRepository.linkRazorpayOrder(userId, orderNumber, razorpayOrder.id);

            if (!linked) {
                throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
            }

            return {
                order: toCamelOrder(linked),
                razorpayOrderId: razorpayOrder.id,
                amountPaise,
                currency: razorpayOrder.currency || 'INR',
                keyId: razorpayKeyId,
            };
        },

        async verifyPayment(userId, proof) {
            const order = await loadOrder(userId, proof.orderNumber);

            const signatureValid = verifyCheckoutSignature({
                keySecret: razorpayKeySecret,
                razorpayOrderId: proof.razorpayOrderId,
                razorpayPaymentId: proof.razorpayPaymentId,
                razorpaySignature: proof.razorpaySignature,
            });

            if (!signatureValid) {
                throw new AppError('Payment verification failed', 400, 'PAYMENT_VERIFICATION_FAILED');
            }

            // The Checkout proof must belong to the Razorpay order we linked
            // to this order when the payment session was created.
            if (!proof.razorpayOrderId || proof.razorpayOrderId !== order.razorpay_order_id) {
                throw new AppError('Payment does not match this order', 400, 'PAYMENT_ORDER_MISMATCH');
            }

            // markPaid() is idempotent, so re-verifying an already-paid order
            // returns the current row untouched instead of failing.
            const paid = await orderRepository.markPaid({
                orderId: order.id,
                razorpayOrderId: order.razorpay_order_id,
                razorpayPaymentId: proof.razorpayPaymentId,
            });

            return toCamelOrder(paid || order);
        },

        async verifyWebhookPayment({ razorpayOrderId, razorpayPaymentId, amountPaise }) {
            const order = await resolveWebhookOrder({ razorpayOrderId, amountPaise });

            // Already paid (duplicate or out-of-order webhook): do not re-mark.
            if (order.payment_status === 'paid') {
                return false;
            }

            const paid = await orderRepository.markPaid({
                orderId: order.id,
                razorpayOrderId,
                razorpayPaymentId,
            });

            return Boolean(paid);
        },

        async recordWebhookPayment({ razorpayOrderId, razorpayPaymentId, amountPaise }) {
            const order = await resolveWebhookOrder({ razorpayOrderId, amountPaise });

            // markPaid() only updates rows that are not paid yet, so a repeated
            // webhook returns the existing row instead of recording twice.
            const paid = await orderRepository.markPaid({
                orderId: order.id,
                razorpayOrderId,
                razorpayPaymentId,
            });

            if (!paid) {
                throw new AppError('Unable to record this payment', 400, 'PAYMENT_RECORD_FAILED');
            }

            return toCamelOrder(paid);
        },
    };
}

export { createCustomerService, buildOrderNumber };
