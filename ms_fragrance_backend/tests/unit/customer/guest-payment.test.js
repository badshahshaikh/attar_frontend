import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

import { config } from '../../../src/config/env.js';
import { optionalCustomerAuth } from '../../../src/shared/middleware/authenticate.js';
import { createCustomerOrderRepository } from '../../../src/modules/customer/customer-order.repository.js';
import { createCustomerService } from '../../../src/modules/customer/customer.service.js';
import { createCustomerController } from '../../../src/modules/customer/customer.controller.js';
import { createCustomerRouter } from '../../../src/modules/customer/customer.routes.js';

const JWT_SECRET = config.auth.jwtSecret || 'test_jwt_secret_for_tests_12345';

function createMockRes() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        },
    };
}

// ── 1. optionalCustomerAuth Middleware ───────────────────────────────────────
test('optionalCustomerAuth middleware behavior', async (t) => {
    await t.test('populates req.customer when valid customer cookie is present', () => {
        const token = jwt.sign({ id: 42, role: 'customer' }, JWT_SECRET);
        const req = {
            cookies: { [config.auth.customerCookie.name]: token },
            headers: {},
        };
        const res = createMockRes();
        let nextCalled = false;

        optionalCustomerAuth(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.ok(req.customer);
        assert.equal(req.customer.id, 42);
        assert.equal(req.customer.role, 'customer');
    });

    await t.test('populates req.customer from Authorization Bearer header when cookie missing', () => {
        const token = jwt.sign({ id: 99, role: 'customer' }, JWT_SECRET);
        const req = {
            cookies: {},
            headers: { authorization: `Bearer ${token}` },
        };
        const res = createMockRes();
        let nextCalled = false;

        optionalCustomerAuth(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.ok(req.customer);
        assert.equal(req.customer.id, 99);
        assert.equal(req.customer.role, 'customer');
    });

    await t.test('sets req.customer to null when no credentials present without throwing 401', () => {
        const req = { cookies: {}, headers: {} };
        const res = createMockRes();
        let nextCalled = false;

        optionalCustomerAuth(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.equal(req.customer, null);
        assert.equal(res.statusCode, 200);
    });

    await t.test('sets req.customer to null when token is invalid or expired without throwing 401', () => {
        const req = {
            cookies: { [config.auth.customerCookie.name]: 'corrupted-jwt-token' },
            headers: {},
        };
        const res = createMockRes();
        let nextCalled = false;

        optionalCustomerAuth(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.equal(req.customer, null);
        assert.equal(res.statusCode, 200);
    });

    await t.test('sets req.customer to null when token role is not customer', () => {
        const token = jwt.sign({ id: 1, role: 'admin' }, JWT_SECRET);
        const req = {
            cookies: { [config.auth.customerCookie.name]: token },
            headers: {},
        };
        const res = createMockRes();
        let nextCalled = false;

        optionalCustomerAuth(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.equal(req.customer, null);
    });
});

// ── 2. customerOrderRepository guest query support ───────────────────────────
test('customerOrderRepository guest order queries', async (t) => {
    await t.test('findByOrderNumber with userId == null queries WHERE user_id IS NULL', async () => {
        const executedQueries = [];
        const executedParams = [];

        const mockRepo = createCustomerOrderRepository({
            query: async (text, params) => {
                executedQueries.push(text);
                executedParams.push(params);
                if (text.includes('FROM public.orders')) {
                    return {
                        rows: [{
                            id: 10,
                            order_number: 'MSF-GUEST-1',
                            user_id: null,
                            status: 'placed',
                            payment_status: 'unpaid',
                        }],
                    };
                }
                return { rows: [] };
            },
        });

        const order = await mockRepo.findByOrderNumber(null, 'MSF-GUEST-1');
        assert.ok(order);
        assert.equal(order.order_number, 'MSF-GUEST-1');
        const orderQuery = executedQueries.find((q) => q.includes('FROM public.orders'));
        assert.ok(orderQuery);
        assert.match(orderQuery, /user_id IS NULL/);
        assert.deepEqual(executedParams[0], ['MSF-GUEST-1']);
    });

    await t.test('findByOrderNumber with userId != null queries WHERE user_id = $1', async () => {
        const executedQueries = [];
        const executedParams = [];

        const mockRepo = createCustomerOrderRepository({
            query: async (text, params) => {
                executedQueries.push(text);
                executedParams.push(params);
                if (text.includes('FROM public.orders')) {
                    return {
                        rows: [{
                            id: 11,
                            order_number: 'MSF-USER-1',
                            user_id: 42,
                            status: 'placed',
                            payment_status: 'unpaid',
                        }],
                    };
                }
                return { rows: [] };
            },
        });

        const order = await mockRepo.findByOrderNumber(42, 'MSF-USER-1');
        assert.ok(order);
        const orderQuery = executedQueries.find((q) => q.includes('FROM public.orders'));
        assert.ok(orderQuery);
        assert.match(orderQuery, /user_id = \$1/);
        assert.deepEqual(executedParams[0], [42, 'MSF-USER-1']);
    });

    await t.test('linkRazorpayOrder with userId == null updates WHERE user_id IS NULL', async () => {
        const executedQueries = [];
        const executedParams = [];

        const mockRepo = createCustomerOrderRepository({
            query: async (text, params) => {
                executedQueries.push(text);
                executedParams.push(params);
                if (text.includes('UPDATE public.orders')) {
                    return {
                        rows: [{
                            id: 10,
                            order_number: 'MSF-GUEST-1',
                            user_id: null,
                            razorpay_order_id: 'order_rzp_guest',
                        }],
                    };
                }
                return { rows: [] };
            },
        });

        const linked = await mockRepo.linkRazorpayOrder(null, 'MSF-GUEST-1', 'order_rzp_guest');
        assert.ok(linked);
        const updateQuery = executedQueries.find((q) => q.includes('UPDATE public.orders'));
        assert.ok(updateQuery);
        assert.match(updateQuery, /WHERE user_id IS NULL AND order_number = \$1/);
        assert.deepEqual(executedParams[0], ['MSF-GUEST-1', 'order_rzp_guest']);
    });

    await t.test('linkRazorpayOrder with userId != null updates WHERE user_id = $1', async () => {
        const executedQueries = [];
        const executedParams = [];

        const mockRepo = createCustomerOrderRepository({
            query: async (text, params) => {
                executedQueries.push(text);
                executedParams.push(params);
                if (text.includes('UPDATE public.orders')) {
                    return {
                        rows: [{
                            id: 11,
                            order_number: 'MSF-USER-1',
                            user_id: 42,
                            razorpay_order_id: 'order_rzp_user',
                        }],
                    };
                }
                return { rows: [] };
            },
        });

        const linked = await mockRepo.linkRazorpayOrder(42, 'MSF-USER-1', 'order_rzp_user');
        assert.ok(linked);
        const updateQuery = executedQueries.find((q) => q.includes('UPDATE public.orders'));
        assert.ok(updateQuery);
        assert.match(updateQuery, /WHERE user_id = \$1 AND order_number = \$2/);
        assert.deepEqual(executedParams[0], [42, 'MSF-USER-1', 'order_rzp_user']);
    });

    await t.test('claimGuestOrders links unassigned orders matching phone/email to customer', async () => {
        let executedQuery = '';
        let executedParams = [];

        const mockRepo = createCustomerOrderRepository({
            query: async (text, params) => {
                executedQuery = text;
                executedParams = params;
                return { rows: [{ id: 101 }, { id: 102 }] };
            },
        });

        const claimed = await mockRepo.claimGuestOrders(77, {
            phone: '+91 98765 43210',
            email: 'AISHA@EXAMPLE.COM',
        });

        assert.equal(claimed, 2);
        assert.match(executedQuery, /UPDATE public\.orders/);
        assert.match(executedQuery, /WHERE user_id IS NULL/);
        assert.match(executedQuery, /contact_phone LIKE/);
        assert.match(executedQuery, /LOWER\(COALESCE\(shipping_address->>'email'/);
        assert.equal(executedParams[0], 77);
        assert.equal(executedParams[1], '%9876543210');
        assert.equal(executedParams[2], 'aisha@example.com');
    });

    await t.test('claimGuestOrders returns 0 and skips update when phone and email are empty', async () => {
        let queryRun = false;
        const mockRepo = createCustomerOrderRepository({
            query: async () => {
                queryRun = true;
                return { rows: [] };
            },
        });

        const claimed = await mockRepo.claimGuestOrders(77, { phone: '', email: '' });
        assert.equal(claimed, 0);
        assert.equal(queryRun, false);
    });
});

// ── 3. customerService Guest Payment & Verification Edge Cases ──────────────
test('customerService guest payment session and verification flows', async (t) => {
    const razorpayKeyId = 'rzp_test_key_123';
    const razorpayKeySecret = 'rzp_test_secret_abc';
    const guestOrderNumber = 'MSF-261119-GUEST';
    const userOrderNumber = 'MSF-261119-USER';
    const rzpOrderId = 'order_rzp_12345';
    const rzpPaymentId = 'pay_rzp_67890';

    const validSignature = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(`${rzpOrderId}|${rzpPaymentId}`)
        .digest('hex');

    let guestOrderRow = {
        id: 50,
        order_number: guestOrderNumber,
        user_id: null,
        contact_name: 'Zoya Fatima',
        contact_phone: '9876543210',
        shipping_address: {
            fullName: 'Zoya Fatima',
            phone: '9876543210',
            email: 'zoya@example.com',
            city: 'Hyderabad',
        },
        status: 'placed',
        payment_status: 'unpaid',
        total: 899,
        razorpay_order_id: rzpOrderId,
    };

    let userOrderRow = {
        id: 51,
        order_number: userOrderNumber,
        user_id: 100,
        contact_name: 'Imran Ali',
        contact_phone: '9123456780',
        shipping_address: {
            fullName: 'Imran Ali',
            phone: '9123456780',
            email: 'imran@example.com',
        },
        status: 'placed',
        payment_status: 'unpaid',
        total: 1200,
        razorpay_order_id: rzpOrderId,
    };

    function buildService(overrides = {}) {
        return createCustomerService({
            addressRepository: {},
            orderRepository: {
                findByOrderNumber: async (userId, orderNumber) => {
                    if (userId === null && orderNumber === guestOrderNumber) return guestOrderRow;
                    if (userId === 100 && orderNumber === userOrderNumber) return userOrderRow;
                    return null;
                },
                linkRazorpayOrder: async (userId, orderNumber, rId) => {
                    if (userId === null && orderNumber === guestOrderNumber) {
                        guestOrderRow = { ...guestOrderRow, razorpay_order_id: rId };
                        return guestOrderRow;
                    }
                    if (userId === 100 && orderNumber === userOrderNumber) {
                        userOrderRow = { ...userOrderRow, razorpay_order_id: rId };
                        return userOrderRow;
                    }
                    return null;
                },
                markPaid: async ({ orderId, razorpayOrderId, razorpayPaymentId }) => {
                    if (orderId === guestOrderRow.id) {
                        guestOrderRow = {
                            ...guestOrderRow,
                            payment_status: 'paid',
                            status: 'paid',
                            razorpay_payment_id: razorpayPaymentId,
                        };
                        return guestOrderRow;
                    }
                    return null;
                },
                ...overrides.orderRepository,
            },
            razorpayClient: {
                createOrder: async ({ amountPaise, receipt }) => ({
                    id: rzpOrderId,
                    currency: 'INR',
                    amount: amountPaise,
                    receipt,
                }),
                ...overrides.razorpayClient,
            },
            razorpayKeyId,
            razorpayKeySecret,
        });
    }

    await t.test('guest creates payment session successfully (userId == null)', async () => {
        const service = buildService();
        const session = await service.createPaymentSession(null, guestOrderNumber);

        assert.equal(session.razorpayOrderId, rzpOrderId);
        assert.equal(session.amountPaise, 89900);
        assert.equal(session.currency, 'INR');
        assert.equal(session.keyId, razorpayKeyId);
    });

    await t.test('guest contact phone verification succeeds with formatted number', async () => {
        const service = buildService();
        const session = await service.createPaymentSession(null, guestOrderNumber, {
            contactPhone: '+91 98765 43210',
        });
        assert.equal(session.razorpayOrderId, rzpOrderId);
    });

    await t.test('guest contact phone verification fails with wrong number (404)', async () => {
        const service = buildService();
        await assert.rejects(
            () => service.createPaymentSession(null, guestOrderNumber, {
                contactPhone: '9999999999',
            }),
            (err) => err.statusCode === 404 && err.code === 'ORDER_NOT_FOUND'
        );
    });

    await t.test('guest contact email verification succeeds case-insensitively', async () => {
        const service = buildService();
        const session = await service.createPaymentSession(null, guestOrderNumber, {
            contactEmail: 'ZOYA@EXAMPLE.COM',
        });
        assert.equal(session.razorpayOrderId, rzpOrderId);
    });

    await t.test('guest contact email verification fails with wrong email (404)', async () => {
        const service = buildService();
        await assert.rejects(
            () => service.createPaymentSession(null, guestOrderNumber, {
                contactEmail: 'stranger@example.com',
            }),
            (err) => err.statusCode === 404 && err.code === 'ORDER_NOT_FOUND'
        );
    });

    await t.test('IDOR protection: guest (userId == null) cannot access authenticated user order', async () => {
        const service = buildService();
        await assert.rejects(
            () => service.createPaymentSession(null, userOrderNumber),
            (err) => err.statusCode === 404 && err.code === 'ORDER_NOT_FOUND'
        );
    });

    await t.test('IDOR protection: User A (userId == 200) cannot access User B (userId == 100) order', async () => {
        const service = buildService();
        await assert.rejects(
            () => service.createPaymentSession(200, userOrderNumber),
            (err) => err.statusCode === 404 && err.code === 'ORDER_NOT_FOUND'
        );
    });

    await t.test('cannot create payment session for already-paid order (400)', async () => {
        const service = buildService({
            orderRepository: {
                findByOrderNumber: async () => ({ ...guestOrderRow, payment_status: 'paid' }),
            },
        });
        await assert.rejects(
            () => service.createPaymentSession(null, guestOrderNumber),
            (err) => err.statusCode === 400 && err.code === 'ORDER_ALREADY_PAID'
        );
    });

    await t.test('cannot create payment session for cancelled order (400)', async () => {
        const service = buildService({
            orderRepository: {
                findByOrderNumber: async () => ({ ...guestOrderRow, status: 'cancelled' }),
            },
        });
        await assert.rejects(
            () => service.createPaymentSession(null, guestOrderNumber),
            (err) => err.statusCode === 400 && err.code === 'ORDER_CANCELLED'
        );
    });

    await t.test('cannot create payment session for zero or negative total order (400)', async () => {
        const service = buildService({
            orderRepository: {
                findByOrderNumber: async () => ({ ...guestOrderRow, total: 0 }),
            },
        });
        await assert.rejects(
            () => service.createPaymentSession(null, guestOrderNumber),
            (err) => err.statusCode === 400 && err.code === 'INVALID_ORDER_TOTAL'
        );
    });

    await t.test('authenticated user can pay for their guest order with matching phone verification', async () => {
        const service = buildService();
        // User with id 999 pays for guest order by providing matching phone
        const session = await service.createPaymentSession(999, guestOrderNumber, {
            contactPhone: '9876543210',
        });
        assert.equal(session.razorpayOrderId, rzpOrderId);
    });

    await t.test('order number with whitespace is trimmed and resolved', async () => {
        const service = buildService();
        const session = await service.createPaymentSession(null, `  ${guestOrderNumber}  `);
        assert.equal(session.razorpayOrderId, rzpOrderId);
    });

    await t.test('guest payment verification marks guest order paid with valid signature', async () => {
        const service = buildService();
        const paidOrder = await service.verifyPayment(null, {
            orderNumber: guestOrderNumber,
            razorpayOrderId: rzpOrderId,
            razorpayPaymentId: rzpPaymentId,
            razorpaySignature: validSignature,
            contactPhone: '9876543210',
        });

        assert.equal(paidOrder.paymentStatus, 'paid');
        assert.equal(paidOrder.status, 'paid');
    });

    await t.test('payment verification rejects tampered signature (400)', async () => {
        const service = buildService();
        await assert.rejects(
            () => service.verifyPayment(null, {
                orderNumber: guestOrderNumber,
                razorpayOrderId: rzpOrderId,
                razorpayPaymentId: rzpPaymentId,
                razorpaySignature: 'invalid_tampered_signature',
            }),
            (err) => err.statusCode === 400 && err.code === 'PAYMENT_VERIFICATION_FAILED'
        );
    });

    await t.test('payment verification rejects mismatched razorpay order id (400)', async () => {
        const service = buildService();
        const differentOrderId = 'order_different_99999';
        const signatureForDifferent = crypto
            .createHmac('sha256', razorpayKeySecret)
            .update(`${differentOrderId}|${rzpPaymentId}`)
            .digest('hex');

        await assert.rejects(
            () => service.verifyPayment(null, {
                orderNumber: guestOrderNumber,
                razorpayOrderId: differentOrderId,
                razorpayPaymentId: rzpPaymentId,
                razorpaySignature: signatureForDifferent,
            }),
            (err) => err.statusCode === 400 && err.code === 'PAYMENT_ORDER_MISMATCH'
        );
    });
});

// ── 4. customerController & customerRouter End-to-End Integration ────────────
test('customerController and router integration for guest payment', async (t) => {
    await t.test('controller createPaymentSession passes customerId == null for guest', async () => {
        let capturedUserId = 'unset';
        let capturedVerification = null;

        const mockService = {
            createPaymentSession: async (userId, orderNumber, verification) => {
                capturedUserId = userId;
                capturedVerification = verification;
                return { razorpayOrderId: 'order_test_1' };
            },
        };

        const controller = createCustomerController({ customerService: mockService });
        const req = {
            params: { orderNumber: 'MSF-123' },
            customer: null,
            body: { phone: '9876543210' },
            query: {},
        };
        const res = createMockRes();

        await controller.createPaymentSession(req, res);

        assert.equal(capturedUserId, null);
        assert.equal(capturedVerification.contactPhone, '9876543210');
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
    });

    await t.test('controller returns 400 when orderNumber is missing', async () => {
        const controller = createCustomerController({ customerService: {} });
        const req = { params: { orderNumber: '' } };
        const res = createMockRes();

        await controller.createPaymentSession(req, res);
        assert.equal(res.statusCode, 400);
        assert.match(res.body.message, /Order number is required/i);
    });

    await t.test('router registers payment endpoints BEFORE authenticateCustomer', () => {
        const mockController = {
            createGuestOrder: () => {},
            createPaymentSession: () => {},
            verifyPayment: () => {},
            listAddresses: () => {},
            createAddress: () => {},
            getAddress: () => {},
            updateAddress: () => {},
            deleteAddress: () => {},
            setDefaultAddress: () => {},
            listOrders: () => {},
            createOrder: () => {},
            getOrder: () => {},
        };

        const router = createCustomerRouter(mockController);
        const layers = router.stack;

        // Find index of authenticateCustomer middleware
        const authCustomerIndex = layers.findIndex(
            (layer) => layer.name === 'authenticateCustomer' || layer.handle?.name === 'authenticateCustomer'
        );
        assert.ok(authCustomerIndex > 0, 'authenticateCustomer must be present in router');

        // Find payment session and verify route layers
        const paymentSessionIndex = layers.findIndex(
            (layer) => layer.route && layer.route.path === '/orders/:orderNumber/payment'
        );
        const paymentVerifyIndex = layers.findIndex(
            (layer) => layer.route && layer.route.path === '/orders/:orderNumber/payment/verify'
        );

        assert.ok(paymentSessionIndex !== -1, 'Payment session route must be registered');
        assert.ok(paymentVerifyIndex !== -1, 'Payment verify route must be registered');

        // Verify both are registered BEFORE authenticateCustomer
        assert.ok(
            paymentSessionIndex < authCustomerIndex,
            'Payment session route must be declared before authenticateCustomer'
        );
        assert.ok(
            paymentVerifyIndex < authCustomerIndex,
            'Payment verify route must be declared before authenticateCustomer'
        );
    });
});
