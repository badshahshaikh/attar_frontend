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

function createCustomerService({ addressRepository, orderRepository, razorpayKeyId, razorpayKeySecret, razorpayClient }) {
    // Key material is injected by the container; when it is missing the client
    // refuses to create orders (503 PAYMENTS_DISABLED) instead of failing
    // halfway through a checkout.
    const razorpay = razorpayClient || createRazorpayClient({ keyId: razorpayKeyId, keySecret: razorpayKeySecret });

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

            // Early, friendly availability check so the shopper gets a clear
            // message before the order is attempted. The database transaction is
            // still the authoritative guard against overselling; this only
            // improves the error for the common "sold out while I was browsing"
            // case and mirrors the frontend availability rule (in_stock AND
            // stock_quantity > 0).
            const stockQuantity = Number(product.stock_quantity);
            const available = product.in_stock === true && Number.isFinite(stockQuantity) && stockQuantity > 0;

            if (!available) {
                throw new AppError(
                    `"${product.name}" is currently out of stock`,
                    409,
                    'INSUFFICIENT_STOCK'
                );
            }

            if (item.quantity > stockQuantity) {
                throw new AppError(
                    `Sorry, "${product.name}" has only ${stockQuantity} unit${stockQuantity === 1 ? '' : 's'} left`,
                    409,
                    'INSUFFICIENT_STOCK'
                );
            }

            const unitPrice = priceForSize(product, item.size);

            // Frontend guards are advisory only. The authoritative, race-safe
            // deduction (and final overselling guard) happens inside the
            // repository transaction; the checks above fail fast with a clear
            // message for the common "sold out while I was browsing" case.

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

    // Shared persistence path for signed-in AND guest orders. Prices, shipping
    // and totals are always recomputed here from the products table (never the
    // client), stock is reserved atomically inside orderRepository.create, and
    // the unique order_number is retried on the rare collision. `userId` may be
    // null for guests — the orders table allows it so no account is required.
    async function persistOrder(userId, { address, contactName, contactPhone, notes, source, items }) {
        const products = await orderRepository.findProductsByIds(
            [...new Set(items.map((item) => item.productId))]
        );

        const lines = buildLines(items, products);
        const subtotal = Number(
            lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2)
        );
        const shipping = subtotal > FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_CHARGE;
        const total = Number((subtotal + shipping).toFixed(2));

        // order_number is unique, so retry on the rare collision.
        for (let attempt = 0; attempt < ORDER_NUMBER_ATTEMPTS; attempt += 1) {
            try {
                const order = await orderRepository.create(userId, {
                    orderNumber: buildOrderNumber(),
                    address,
                    contactName: contactName || address.fullName,
                    contactPhone: contactPhone || address.phone,
                    notes,
                    source,
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
    }

    function normalizePhone(raw) {
        if (!raw) return '';
        const digits = String(raw).replace(/\D/g, '');
        return digits.length >= 10 ? digits.slice(-10) : digits;
    }

    // Loads an order that belongs to this customer, or 404s exactly like the
    // GET /orders/:orderNumber handler does.
    // Supports guest orders when userId is null; if contactPhone or contactEmail
    // is provided in verification, verifies that it matches the order record.
    async function loadOrder(userId, orderNumber, verification = {}) {
        const cleanOrderNumber = String(orderNumber || '').trim();
        const validUserId = typeof userId === 'number' && Number.isInteger(userId) && userId > 0
            ? userId
            : null;

        let order = await orderRepository.findByOrderNumber(validUserId, cleanOrderNumber);

        // Fallback: If not found under customer account, check if it is an unassigned guest order
        // matching the verified contact details
        if (!order && validUserId != null && (verification.contactPhone || verification.contactEmail)) {
            const guestOrder = await orderRepository.findByOrderNumber(null, cleanOrderNumber);
            if (guestOrder) {
                let address = guestOrder.shipping_address;
                if (typeof address === 'string') {
                    try { address = JSON.parse(address); } catch { address = {}; }
                }
                const storedPhone = normalizePhone(guestOrder.contact_phone || address?.phone);
                const inputPhone = normalizePhone(verification.contactPhone);
                const phoneMatch = inputPhone ? storedPhone === inputPhone : false;

                const storedEmail = (address?.email || '').trim().toLowerCase();
                const inputEmail = (verification.contactEmail || '').trim().toLowerCase();
                const emailMatch = inputEmail ? storedEmail === inputEmail : false;

                if ((verification.contactPhone && phoneMatch) || (verification.contactEmail && emailMatch)) {
                    order = guestOrder;
                }
            }
        }

        if (!order) {
            throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
        }

        if (order.user_id == null && (verification.contactPhone || verification.contactEmail)) {
            let address = order.shipping_address;
            if (typeof address === 'string') {
                try { address = JSON.parse(address); } catch { address = {}; }
            }
            const storedPhone = normalizePhone(order.contact_phone || address?.phone);
            const inputPhone = normalizePhone(verification.contactPhone);
            const phoneMatch = inputPhone ? storedPhone === inputPhone : false;

            const storedEmail = (address?.email || '').trim().toLowerCase();
            const inputEmail = (verification.contactEmail || '').trim().toLowerCase();
            const emailMatch = inputEmail ? storedEmail === inputEmail : false;

            if (verification.contactPhone && verification.contactEmail) {
                if (!phoneMatch && !emailMatch) {
                    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
                }
            } else if (verification.contactPhone && !phoneMatch) {
                throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
            } else if (verification.contactEmail && !emailMatch) {
                throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
            }
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
            const address = await resolveAddress(userId, payload);

            return persistOrder(userId, {
                address,
                contactName: payload.contactName,
                contactPhone: payload.contactPhone,
                notes: payload.notes,
                source: payload.source,
                items: payload.items,
            });
        },

        // Guest checkout — no account, no session. `userId` is null so the order
        // is recorded against the contact details only (the orders.user_id column
        // is nullable). The delivery snapshot comes straight from the validated
        // guest form, and pricing/stock/totals go through the exact same
        // persistOrder() path as a signed-in order, so nothing is trusted from
        // the client and no order logic is duplicated.
        async createGuestOrder(payload) {
            return persistOrder(null, {
                address: payload.address,
                contactName: payload.contactName,
                contactPhone: payload.contactPhone,
                notes: payload.notes,
                source: payload.source,
                items: payload.items,
            });
        },

        async createPaymentSession(userId, orderNumber, verification = {}) {
            const order = await loadOrder(userId, orderNumber, verification);

            if (order.status === 'cancelled') {
                throw new AppError('This order has been cancelled and cannot be paid', 400, 'ORDER_CANCELLED');
            }

            if (order.payment_status === 'paid') {
                throw new AppError('This order has already been paid', 400, 'ORDER_ALREADY_PAID');
            }

            // Razorpay speaks paise; the orders table stores rupees.
            const amountPaise = rupeesToPaise(order.total);

            if (amountPaise <= 0) {
                throw new AppError('Invalid order total for online payment', 400, 'INVALID_ORDER_TOTAL');
            }

            const razorpayOrder = await razorpay.createOrder({
                amountPaise,
                receipt: order.order_number,
            });

            // Record which Razorpay order belongs to our order so the verify
            // endpoint and webhooks can match the payment back to it.
            const linked = await orderRepository.linkRazorpayOrder(order.user_id, order.order_number, razorpayOrder.id);

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
            const order = await loadOrder(userId, proof.orderNumber, {
                contactPhone: proof.contactPhone,
                contactEmail: proof.contactEmail,
            });

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
