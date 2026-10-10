/**
 * invoice.util.js — Pure helpers for order invoicing.
 *
 * No I/O, no framework deps, so every rule (invoice numbering, filename, INR
 * formatting, WhatsApp phone normalisation and message encoding) is unit
 * testable from Node, mirroring the other pure modules in the codebase.
 */

// The order number is already unique + stable (orders.order_number, e.g.
// "MSF-261005-AB12"), so the invoice number is derived from it deterministically
// rather than stored in a new column — no migration, always reproducible, and it
// never diverges from the saved order.
const INVOICE_PREFIX = 'INV-';
const BRAND_NAME = 'MS Fragrances';

/** Stable invoice number for an order, derived from its order number. */
function invoiceNumberFor(orderNumber) {
    const base = String(orderNumber || '').trim();
    return `${INVOICE_PREFIX}${base}`;
}

/**
 * Descriptive, filesystem-safe download filename for the invoice PDF, e.g.
 * "MS-Fragrances-Invoice-MSF-261005-AB12.pdf".
 */
function invoiceFilename(orderNumber) {
    const safe = String(orderNumber || 'order')
        .trim()
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return `${BRAND_NAME.replace(/\s+/g, '-')}-Invoice-${safe || 'order'}.pdf`;
}

/** INR money formatting shared with the PDF layout and the WhatsApp message. */
function formatINR(value) {
    const amount = Number(value || 0);
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Human label for a status value (capitalise, fall back to the raw value). */
function statusLabel(status) {
    const value = String(status || '').trim();
    if (!value) return 'Unknown';
    return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Normalise a phone number for a wa.me link.
 *
 * Rules:
 * - Accept a bare 10-digit Indian mobile (starting 6-9) and prefix the country
 *   code 91 exactly once.
 * - Keep a number that already carries a country code as-is (digits only),
 *   never doubling the code.
 * - Reject anything empty, non-numeric, or too short/long.
 *
 * @returns {{ valid: boolean, e164?: string, reason?: string }}
 */
function normalizeWhatsAppPhone(raw) {
    const digits = String(raw == null ? '' : raw).replace(/\D/g, '');

    if (!digits) {
        return { valid: false, reason: 'No customer phone number is available for this order.' };
    }

    // Already carries an international country code (leading '+' or a long
    // number). Keep the digits as-is — do not prepend 91 again.
    const hasPlus = /^\s*\+/.test(String(raw || ''));
    if (hasPlus || digits.length > 10) {
        // Sanity: E.164 allows up to 15 digits.
        if (digits.length < 8 || digits.length > 15) {
            return { valid: false, reason: 'The customer phone number is not a valid number.' };
        }
        return { valid: true, e164: digits };
    }

    // A bare Indian mobile: exactly 10 digits starting 6-9.
    if (/^[6-9]\d{9}$/.test(digits)) {
        return { valid: true, e164: `91${digits}` };
    }

    return { valid: false, reason: 'The customer phone number is not a valid 10-digit mobile number.' };
}

/**
 * Professional WhatsApp message that accompanies a shared invoice. It explains
 * that the invoice is attached (the admin attaches the downloaded PDF by hand —
 * a wa.me link cannot auto-attach files) and carries the saved order + payment
 * status. Uses actual saved values and degrades gracefully when the name is
 * missing.
 */
function buildInvoiceShareMessage({ customerName, orderNumber, orderStatus, paymentStatus }) {
    const name = String(customerName || '').trim() || 'there';
    const status = statusLabel(orderStatus);
    const payment = statusLabel(paymentStatus);

    return [
        `Hello ${name}, thank you for shopping with ${BRAND_NAME}.`,
        `Please find your invoice for order ${orderNumber} attached.`,
        `Order status: ${status}. Payment status: ${payment}.`,
        'Please contact us if you need any assistance.',
    ].join(' ');
}

/**
 * Build the wa.me deep link for a message. The message is the only query
 * parameter and is fully encoded — no customer data is placed in the URL path.
 */
function buildWhatsAppInvoiceUrl(e164, message) {
    return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}

export {
    BRAND_NAME,
    invoiceNumberFor,
    invoiceFilename,
    formatINR,
    statusLabel,
    normalizeWhatsAppPhone,
    buildInvoiceShareMessage,
    buildWhatsAppInvoiceUrl,
};
