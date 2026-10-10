/**
 * invoiceShare.js — Pure helpers for sharing an order invoice on WhatsApp.
 *
 * Mirrors the backend invoice.util.js rules (kept in lock-step) so the admin
 * panel can validate the customer phone number and build the wa.me link before
 * hitting the network. A plain ES module with no browser/JSX deps so it can be
 * unit-tested from Node, like the other pure feature utilities.
 *
 * IMPORTANT: a normal wa.me link CANNOT auto-attach a PDF. This module only
 * prepares the chat + a message that tells the customer the invoice is
 * attached; the admin must attach the downloaded file and send it manually.
 */

const BRAND_NAME = 'MS Fragrances';

/** Human label for a status value (capitalise, fall back to the raw value). */
function statusLabel(status) {
    const value = String(status || '').trim();
    if (!value) return 'Unknown';
    return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Normalise a phone number for a wa.me link.
 * @returns {{ valid: boolean, e164?: string, reason?: string }}
 */
function normalizeWhatsAppPhone(raw) {
    const digits = String(raw == null ? '' : raw).replace(/\D/g, '');

    if (!digits) {
        return { valid: false, reason: 'No customer phone number is available for this order.' };
    }

    const hasPlus = /^\s*\+/.test(String(raw || ''));
    if (hasPlus || digits.length > 10) {
        if (digits.length < 8 || digits.length > 15) {
            return { valid: false, reason: 'The customer phone number is not a valid number.' };
        }
        return { valid: true, e164: digits };
    }

    if (/^[6-9]\d{9}$/.test(digits)) {
        return { valid: true, e164: `91${digits}` };
    }

    return { valid: false, reason: 'The customer phone number is not a valid 10-digit mobile number.' };
}

/** Professional WhatsApp message that accompanies a shared invoice. */
function buildInvoiceShareMessage({ customerName, orderNumber, orderStatus, paymentStatus }) {
    const name = String(customerName || '').trim() || 'there';

    return [
        `Hello ${name}, thank you for shopping with ${BRAND_NAME}.`,
        `Please find your invoice for order ${orderNumber} attached.`,
        `Order status: ${statusLabel(orderStatus)}. Payment status: ${statusLabel(paymentStatus)}.`,
        'Please contact us if you need any assistance.',
    ].join(' ');
}

/** Build the wa.me deep link with the message as the only, fully-encoded param. */
function buildWhatsAppInvoiceUrl(e164, message) {
    return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}

/** Trigger a browser download for a Blob with the given filename. */
function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoke on the next tick so the navigation has started.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export {
    BRAND_NAME,
    statusLabel,
    normalizeWhatsAppPhone,
    buildInvoiceShareMessage,
    buildWhatsAppInvoiceUrl,
    saveBlob,
};
