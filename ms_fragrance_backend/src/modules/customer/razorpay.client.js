/**
 * razorpay.client.js — minimal Razorpay Orders API client.
 *
 * Uses plain fetch (the official SDK adds a dependency for one endpoint and
 * one webhook secret). Test keys work against the same API, so test mode is
 * just a key swap.
 */
import crypto from 'node:crypto';

const RAZORPAY_ORDERS_URL = 'https://api.razorpay.com/v1/orders';

// Amount helpers: Razorpay speaks paise, the orders table speaks rupees.
function rupeesToPaise(rupees) {
    return Math.round(Number(rupees) * 100);
}

function paiseToRupees(paise) {
    return Number((Number(paise) / 100).toFixed(2));
}

function createRazorpayClient({ keyId, keySecret, fetchImpl = fetch }) {
    function requireConfigured() {
        if (!keyId || !keySecret) {
            const error = new Error('Online payments are not configured on this store');
            error.statusCode = 503;
            error.code = 'PAYMENTS_DISABLED';
            error.isOperational = true;
            throw error;
        }
    }

    return {
        configured: () => Boolean(keyId && keySecret),

        async createOrder({ amountPaise, currency = 'INR', receipt }) {
            requireConfigured();

            const response = await fetchImpl(RAZORPAY_ORDERS_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
                },
                body: JSON.stringify({
                    amount: amountPaise,
                    currency,
                    receipt: receipt.slice(0, 40),
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.id) {
                const error = new Error(data?.error?.description || 'Payment session could not be created');
                error.statusCode = 502;
                error.code = 'PAYMENT_SESSION_FAILED';
                error.isOperational = true;
                throw error;
            }

            return data;
        },
    };
}

// Razorpay signs `${razorpayOrderId}|${razorpayPaymentId}` with the key
// secret; the webhook signs the raw request body with the webhook secret.
// Compare with timingSafeEqual so a close-but-wrong guess leaks nothing.
function signaturesMatch(expectedHex, actual) {
    if (typeof actual !== 'string' || actual.length === 0) return false;

    const expected = Buffer.from(expectedHex, 'hex');
    const candidate = Buffer.from(actual, 'utf8');

    if (expected.length !== candidate.length) return false;

    return crypto.timingSafeEqual(expected, candidate);
}

function verifyCheckoutSignature({ keySecret, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    if (!keySecret || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return false;
    }

    const expectedHex = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

    return signaturesMatch(expectedHex, razorpaySignature);
}

function verifyWebhookSignature({ webhookSecret, rawBody, signatureHeader }) {
    if (!webhookSecret || !rawBody) return false;

    const expectedHex = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

    return signaturesMatch(expectedHex, signatureHeader);
}

export {
    createRazorpayClient,
    rupeesToPaise,
    paiseToRupees,
    verifyCheckoutSignature,
    verifyWebhookSignature,
    RAZORPAY_ORDERS_URL,
};
