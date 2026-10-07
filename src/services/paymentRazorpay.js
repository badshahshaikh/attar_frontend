/**
 * paymentRazorpay.js — Razorpay checkout popup.
 *
 * Loads the checkout SDK from CDN once, then opens the payment popup
 * for a server-created Razorpay order. All pricing is server-side;
 * the frontend only sends the HMAC proof for verification.
 */
import { createPaymentSession, verifyPayment } from './customerService';

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

let scriptLoaded = false;

async function ensureScript() {
    if (scriptLoaded) return;
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = CHECKOUT_SCRIPT;
        s.async = true;
        s.onload = () => { scriptLoaded = true; resolve(); };
        s.onerror = () => reject(new Error('Failed to load Razorpay checkout SDK'));
        document.head.appendChild(s);
    });
}

/**
 * Opens the Razorpay checkout popup for an existing order.
 *
 * @param {Object} opts
 * @param {string} opts.orderNumber — the server order to pay for
 * @param {Object} opts.customer — { fullName, email, phone } from the profile
 * @param {Function} opts.onSuccess — called with { razorpayOrderId, razorpayPaymentId, razorpaySignature }
 * @returns {Promise<void>} resolves after payment succeeds (or the popup is dismissed); rejects on failure
 */
export async function openRazorpayCheckout({ orderNumber, customer, onSuccess }) {
    await ensureScript();

    const session = await createPaymentSession(orderNumber);
    const { razorpayOrderId: rzpOrderId, amountPaise, keyId } = session;

    // The popup lifecycle is wrapped in a promise so callers can await the
    // outcome: resolve after onSuccess finishes, reject on payment failure
    // or an onSuccess error, and settle quietly when the popup is dismissed.
    return new Promise((resolve, reject) => {
        let paymentHandled = false;

        const options = {
            key: keyId,
            amount: amountPaise,
            currency: 'INR',
            name: 'MS Fragrance',
            description: `Order ${orderNumber}`,
            order_id: rzpOrderId,
            prefill: {
                name: customer?.fullName || '',
                email: customer?.email || '',
                contact: customer?.phone || '',
            },
            theme: { color: '#9c5248' },
            async handler(payload) {
                paymentHandled = true;
                try {
                    await onSuccess({
                        razorpayOrderId: payload.razorpay_order_id,
                        razorpayPaymentId: payload.razorpay_payment_id,
                        razorpaySignature: payload.razorpay_signature,
                    });
                    resolve();
                } catch (error) {
                    reject(error);
                }
            },
            modal: {
                ondismiss() {
                    // The user closed the popup before paying. If the handler
                    // is already running it owns the promise, so only settle
                    // here when no payment is being processed.
                    if (!paymentHandled) resolve();
                },
            },
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', (response) => {
            const error = new Error(response.error?.description || 'Payment failed');
            error.code = 'PAYMENT_FAILED';
            error.details = response.error;
            reject(error);
        });
        rzp.open();
    });
}

/**
 * Verifies the payment HMAC server-side and marks the order paid.
 */
export { verifyPayment }; // re-export from customerService