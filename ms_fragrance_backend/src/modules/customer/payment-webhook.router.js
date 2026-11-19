/**
 * payment-webhook.router.js � Raw-body receiver for Razorpay webhooks.
 *
 * Mounted BEFORE the global express.json() so the raw request body is available
 * for HMAC verification. Razorpay signs the raw body with the webhook secret:
 *
 *   HMAC-SHA256(webhookSecret, rawRequestBody)  ?  hex
 *
 * The signature is passed in `x-razorpay-signature` and must be compared with
 * `timingSafeEqual` so a close-but-wrong guess leaks nothing.
 *
 * Security requirements (implemented):
 *   1. Reject missing/invalid signatures with 401.
 *   2. Only handle the `payment.captured` event.
 *   3. Verify the Razorpay order_id and payment amount against a server-side
 *      order before marking anything paid (no forged webhooks can flip an
 *      order to paid).
 *   4. Keep payment updates idempotent (webhooks can be delivered multiple
 *      times and out of order).
 */

import { Router } from 'express';
import crypto from 'node:crypto';
import { logger } from '../../shared/logging/logger.js';

function signaturesMatch(expectedHex, actual) {
    if (typeof actual !== 'string' || actual.length === 0) return false;

    const expected = Buffer.from(expectedHex, 'utf8');
    const candidate = Buffer.from(actual, 'utf8');

    if (expected.length !== candidate.length) return false;

    return crypto.timingSafeEqual(expected, candidate);
}

function verifyWebhookSignature({ webhookSecret, rawBody, signatureHeader }) {
    if (!webhookSecret || !rawBody || !signatureHeader) return false;

    const expectedHex = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

    return signaturesMatch(expectedHex, signatureHeader);
}

function createPaymentWebhookRouter(customerService) {
    const router = Router();

    router.post('/razorpay', (req, res) => {
        // Collect the raw body bytes. Use an array of Buffers and join at the
        // end so multi-byte characters and exact framing are preserved.
        const chunks = [];
        let totalSize = 0;
        const MAX_BODY = 1024 * 1024; // 1 MB safety cap

        req.on('data', (chunk) => {
            if (totalSize + chunk.length > MAX_BODY) {
                req.destroy(new Error('Webhook body too large'));
                return;
            }
            chunks.push(chunk);
            totalSize += chunk.length;
        });

        req.on('end', async () => {
            const rawBody = Buffer.concat(chunks).toString('utf8');

            const signatureHeader = req.headers['x-razorpay-signature'];
            const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

            // 1. Verify the signature before doing anything else. A missing or
            //    invalid signature means this webhook did not come from
            //    Razorpay � reject it immediately with 401.
            if (!verifyWebhookSignature({ webhookSecret, rawBody, signatureHeader })) {
                logger.warn('[PAYMENT_WEBHOOK_REJECTED]', {
                    requestId: req.id,
                    reason: 'invalid-or-missing-signature',
                });
                return res.status(401).json({ status: 'error', message: 'Invalid signature' });
            }

            let parsedBody;
            try {
                parsedBody = JSON.parse(rawBody);
            } catch (error) {
                logger.error('[PAYMENT_WEBHOOK_PARSE_ERROR]', {
                    requestId: req.id,
                    errorMessage: error.message,
                });
                return res.status(400).json({ status: 'error', message: 'Invalid JSON' });
            }

            const event = parsedBody.event || '';
            const payload = parsedBody.payload || {};
            const paymentEntity = payload.payment?.entity || {};

            // 2. Only handle the `payment.captured` event; ignore everything
            //    else (including `payment.authorized`, `payment.failed`, etc.)
            //    so a captured webhook is the only signal that marks an order paid.
            if (event !== 'payment.captured') {
                logger.debug('[PAYMENT_WEBHOOK_IGNORED]', {
                    requestId: req.id,
                    event,
                });
                return res.status(200).json({ status: 'ok' });
            }

            const rzpOrder = paymentEntity.order_id;
            const rzpPaymentId = paymentEntity.id;
            const rzpAmount = paymentEntity.amount;

            if (!rzpOrder || !rzpPaymentId) {
                logger.warn('[PAYMENT_WEBHOOK_SKIPPED]', {
                    requestId: req.id,
                    reason: 'missing-order-or-payment-id',
                });
                return res.status(200).json({ status: 'ok' });
            }

            try {
                // 3. Verify the claim against the server-side order before
                //    touching any payment state. The order must exist and the
                //    amount (in paise) must match what we recorded.
                const verified = await customerService.verifyWebhookPayment({
                    razorpayOrderId: rzpOrder,
                    razorpayPaymentId: rzpPaymentId,
                    amountPaise: rzpAmount,
                });

                if (verified) {
                    logger.info('[PAYMENT_WEBHOOK_PROCESSED]', {
                        requestId: req.id,
                        razorpayOrderId: rzpOrder,
                        razorpayPaymentId: rzpPaymentId,
                    });
                } else {
                    // Already paid (or a benign retry). Do not re-mark.
                    logger.debug('[PAYMENT_WEBHOOK_IDEMPOTENT]', {
                        requestId: req.id,
                        razorpayOrderId: rzpOrder,
                    });
                }
            } catch (error) {
                logger.error('[PAYMENT_WEBHOOK_ERROR]', {
                    requestId: req.id,
                    errorMessage: error.message,
                    razorpayOrderId: rzpOrder,
                    razorpayPaymentId: rzpPaymentId,
                });

                // A processing failure must not look like success: tell
                // Razorpay the webhook failed (so it retries) and skip the
                // success response below.
                return res.status(500).json({ status: 'error', message: 'Payment processing failed' });
            }

            res.status(200).json({ status: 'ok' });
        });

        req.on('error', (error) => {
            logger.error('[PAYMENT_WEBHOOK_DATA_ERROR]', {
                requestId: req.id,
                errorMessage: error.message,
            });
            res.status(400).json({ status: 'error', message: 'Failed to read body' });
        });
    });

    return router;
}

export { createPaymentWebhookRouter };