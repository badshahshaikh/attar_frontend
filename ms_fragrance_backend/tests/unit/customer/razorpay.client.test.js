import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

import {
    verifyCheckoutSignature,
    verifyWebhookSignature,
} from '../../../src/modules/customer/razorpay.client.js';
import {
    createPaymentWebhookRouter,
} from '../../../src/modules/customer/payment-webhook.router.js';
import {
    createCustomerService,
} from '../../../src/modules/customer/customer.service.js';

test('Razorpay Checkout Signature Verification', async (t) => {
    const keySecret = 'test_secret_key_12345';
    const razorpayOrderId = 'order_DAvplN4p00g4HG';
    const razorpayPaymentId = 'pay_29QQoUBcxQtvFt';

    const validSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

    await t.test('accepts a valid checkout signature', () => {
        const isValid = verifyCheckoutSignature({
            keySecret,
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature: validSignature,
        });
        assert.equal(isValid, true, 'Valid checkout signature should verify successfully');
    });

    await t.test('rejects a tampered checkout signature', () => {
        const tamperedSignature = validSignature.slice(0, -1) + (validSignature.endsWith('a') ? 'b' : 'a');
        const isValid = verifyCheckoutSignature({
            keySecret,
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature: tamperedSignature,
        });
        assert.equal(isValid, false, 'Tampered checkout signature must fail verification');
    });

    await t.test('rejects missing or empty checkout parameters', () => {
        assert.equal(
            verifyCheckoutSignature({ keySecret: '', razorpayOrderId, razorpayPaymentId, razorpaySignature: validSignature }),
            false
        );
        assert.equal(
            verifyCheckoutSignature({ keySecret, razorpayOrderId: '', razorpayPaymentId, razorpaySignature: validSignature }),
            false
        );
        assert.equal(
            verifyCheckoutSignature({ keySecret, razorpayOrderId, razorpayPaymentId: '', razorpaySignature: validSignature }),
            false
        );
        assert.equal(
            verifyCheckoutSignature({ keySecret, razorpayOrderId, razorpayPaymentId, razorpaySignature: '' }),
            false
        );
        assert.equal(
            verifyCheckoutSignature({ keySecret, razorpayOrderId, razorpayPaymentId, razorpaySignature: null }),
            false
        );
    });
});

test('Razorpay Webhook Signature Verification in razorpay.client.js', async (t) => {
    const webhookSecret = 'whsec_test_secret_98765';
    const rawBody = JSON.stringify({
        event: 'payment.captured',
        payload: {
            payment: {
                entity: {
                    id: 'pay_29QQoUBcxQtvFt',
                    order_id: 'order_DAvplN4p00g4HG',
                    amount: 50000,
                },
            },
        },
    });

    const validSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

    await t.test('accepts a valid webhook signature', () => {
        const isValid = verifyWebhookSignature({
            webhookSecret,
            rawBody,
            signatureHeader: validSignature,
        });
        assert.equal(isValid, true, 'Valid webhook signature should verify successfully');
    });

    await t.test('rejects a tampered webhook body', () => {
        const tamperedBody = rawBody + ' ';
        const isValid = verifyWebhookSignature({
            webhookSecret,
            rawBody: tamperedBody,
            signatureHeader: validSignature,
        });
        assert.equal(isValid, false, 'Tampered webhook body must fail verification');
    });

    await t.test('rejects a tampered webhook signature', () => {
        const tamperedSignature = validSignature.slice(0, -1) + (validSignature.endsWith('a') ? 'b' : 'a');
        const isValid = verifyWebhookSignature({
            webhookSecret,
            rawBody,
            signatureHeader: tamperedSignature,
        });
        assert.equal(isValid, false, 'Tampered webhook signature must fail verification');
    });

    await t.test('rejects missing or empty webhook parameters', () => {
        assert.equal(
            verifyWebhookSignature({ webhookSecret: '', rawBody, signatureHeader: validSignature }),
            false
        );
        assert.equal(
            verifyWebhookSignature({ webhookSecret, rawBody: '', signatureHeader: validSignature }),
            false
        );
        assert.equal(
            verifyWebhookSignature({ webhookSecret, rawBody, signatureHeader: '' }),
            false
        );
        assert.equal(
            verifyWebhookSignature({ webhookSecret, rawBody, signatureHeader: null }),
            false
        );
    });
});

test('Payment Webhook Router endpoint verification', async (t) => {
    const originalSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const webhookSecret = 'whsec_router_test_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

    t.after(() => {
        if (originalSecret !== undefined) {
            process.env.RAZORPAY_WEBHOOK_SECRET = originalSecret;
        } else {
            delete process.env.RAZORPAY_WEBHOOK_SECRET;
        }
    });

    const payload = {
        event: 'payment.captured',
        payload: {
            payment: {
                entity: {
                    id: 'pay_998877',
                    order_id: 'order_112233',
                    amount: 25000,
                },
            },
        },
    };
    const rawBody = JSON.stringify(payload);
    const validSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

    function createMockReqRes({ signature, body }) {
        const req = new EventEmitter();
        req.headers = { 'x-razorpay-signature': signature };
        req.id = 'req-test-1';

        const res = {
            statusCode: null,
            body: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(data) {
                this.body = data;
                return this;
            },
        };

        return { req, res };
    }

    await t.test('incoming valid webhook marks order paid and returns 200', async () => {
        let verifyCalledWith = null;
        const mockCustomerService = {
            verifyWebhookPayment: async (data) => {
                verifyCalledWith = data;
                return true;
            },
        };

        const router = createPaymentWebhookRouter(mockCustomerService);
        // Find the POST /razorpay route handler
        const layer = router.stack.find((l) => l.route && l.route.path === '/razorpay');
        assert.ok(layer, 'Route POST /razorpay exists');
        const handler = layer.route.stack[0].handle;

        const { req, res } = createMockReqRes({
            signature: validSignature,
            body: rawBody,
        });

        const handlePromise = new Promise((resolve) => {
            const originalJson = res.json.bind(res);
            res.json = (data) => {
                originalJson(data);
                resolve();
            };
        });

        handler(req, res);
        req.emit('data', Buffer.from(rawBody));
        req.emit('end');

        await handlePromise;

        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { status: 'ok' });
        assert.deepEqual(verifyCalledWith, {
            razorpayOrderId: 'order_112233',
            razorpayPaymentId: 'pay_998877',
            amountPaise: 25000,
        });
    });

    await t.test('incoming invalid webhook signature returns 401', async () => {
        let verifyCalled = false;
        const mockCustomerService = {
            verifyWebhookPayment: async () => {
                verifyCalled = true;
                return true;
            },
        };

        const router = createPaymentWebhookRouter(mockCustomerService);
        const layer = router.stack.find((l) => l.route && l.route.path === '/razorpay');
        const handler = layer.route.stack[0].handle;

        const { req, res } = createMockReqRes({
            signature: 'invalid_signature_hex_12345',
            body: rawBody,
        });

        const handlePromise = new Promise((resolve) => {
            const originalJson = res.json.bind(res);
            res.json = (data) => {
                originalJson(data);
                resolve();
            };
        });

        handler(req, res);
        req.emit('data', Buffer.from(rawBody));
        req.emit('end');

        await handlePromise;

        assert.equal(res.statusCode, 401);
        assert.equal(verifyCalled, false);
    });
});

test('CustomerService verifyPayment with valid/invalid Razorpay signatures', async (t) => {
    const razorpayKeyId = 'rzp_test_key_123';
    const razorpayKeySecret = 'rzp_test_secret_abc456';
    const userId = 42;
    const orderNumber = 'MSF-261119-TEST';
    const razorpayOrderId = 'order_test_999';
    const razorpayPaymentId = 'pay_test_888';

    const validSignature = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

    let markedPaidParams = null;
    let orderRow = {
        id: 101,
        order_number: orderNumber,
        user_id: userId,
        status: 'placed',
        payment_status: 'pending',
        razorpay_order_id: razorpayOrderId,
        total: 500,
    };

    const mockOrderRepository = {
        findByOrderNumber: async (uId, oNum) => {
            if (uId === userId && oNum === orderNumber) return orderRow;
            return null;
        },
        markPaid: async (params) => {
            markedPaidParams = params;
            orderRow = { ...orderRow, payment_status: 'paid', status: 'confirmed' };
            return orderRow;
        },
    };

    const service = createCustomerService({
        addressRepository: {},
        orderRepository: mockOrderRepository,
        razorpayKeyId,
        razorpayKeySecret,
    });

    await t.test('successfully verified checkout transaction updates order payment_status to paid', async () => {
        const result = await service.verifyPayment(userId, {
            orderNumber,
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature: validSignature,
        });

        assert.equal(result.paymentStatus, 'paid');
        assert.deepEqual(markedPaidParams, {
            orderId: 101,
            razorpayOrderId,
            razorpayPaymentId,
        });
    });

    await t.test('tampered signature rejects with PAYMENT_VERIFICATION_FAILED and does not mark paid', async () => {
        markedPaidParams = null;
        const tamperedSignature = validSignature.slice(0, -2) + '00';

        await assert.rejects(
            () => service.verifyPayment(userId, {
                orderNumber,
                razorpayOrderId,
                razorpayPaymentId,
                razorpaySignature: tamperedSignature,
            }),
            (err) => err.statusCode === 400 && err.code === 'PAYMENT_VERIFICATION_FAILED'
        );

        assert.equal(markedPaidParams, null);
    });
});

