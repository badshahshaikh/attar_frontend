/**
 * orderMessage.js — Pure WhatsApp helpers for checkout.
 *
 * The WhatsApp URL and the order summary message are built here (no JSX, no
 * browser-only globals except WHATSAPP_NUMBER which is a plain constant) so the
 * exact text a customer sends can be unit-tested from Node, mirroring how
 * cartReducer.js and utils/stock.js are tested.
 *
 * The order message is always built from the SAVED backend order response
 * (never the client cart), so the order number, prices and totals shown in the
 * chat match exactly what was recorded. Customer details are carried only
 * inside the encoded message body — never as URL query parameters.
 */

import { WHATSAPP_NUMBER } from '../../../config/constants.js';

/** Formats money in Indian Rupees, deterministic across Node and browsers. */
function rupees(value) {
    return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** Builds a wa.me deep link for the configured business number. */
function buildWhatsAppUrl(message) {
    const phone = String(WHATSAPP_NUMBER || '').replace(/\D/g, '');

    if (!phone) {
        throw new Error('WhatsApp phone number is not configured.');
    }

    // encodeURIComponent keeps newlines and special characters intact so the
    // prefilled chat renders exactly as composed.
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/** Joins the non-empty parts of a delivery address into one readable line. */
function formatAddressLines(address) {
    if (!address || typeof address !== 'object') return '';

    const parts = [
        address.line1,
        address.line2,
        address.city,
        address.state,
        address.postalCode,
        address.country,
    ]
        .map((part) => (part ? String(part).trim() : ''))
        .filter(Boolean);

    return parts.join(', ');
}

/**
 * Builds the full WhatsApp order message from a saved order.
 *
 * Covers every field the checkout requires: order number, customer name and
 * mobile, complete delivery address + city + PIN, each product's name/size/
 * quantity/price, subtotal, shipping and total, an explicit payment-status note
 * (online payment coming soon — arrangements to be confirmed), and a closing
 * request to confirm availability and delivery details.
 */
function buildGuestOrderMessage(order) {
    const safeOrder = order || {};
    const address = safeOrder.shippingAddress || {};
    const items = Array.isArray(safeOrder.items) ? safeOrder.items : [];

    let message = 'Hello! I placed an order on the MS Fragrances website.\n\n';

    message += `Order Number: ${safeOrder.orderNumber}\n\n`;

    message += 'Delivery Details:\n';
    message += `Name: ${safeOrder.contactName || address.fullName || ''}\n`;
    message += `Mobile: ${safeOrder.contactPhone || address.phone || ''}\n`;
    if (address.email) message += `Email: ${address.email}\n`;
    message += `Address: ${formatAddressLines(address)}\n\n`;

    message += 'Order Details:\n';
    items.forEach((item, index) => {
        message += `${index + 1}. ${item.productName}\n`;
        message += `   Size: ${item.size}\n`;
        message += `   Quantity: ${item.quantity}\n`;
        message += `   Unit Price: ${rupees(item.unitPrice)}\n`;
        message += `   Item Total: ${rupees(item.lineTotal)}\n\n`;
    });

    message += `Subtotal: ${rupees(safeOrder.subtotal)}\n`;
    message += `Shipping: ${Number(safeOrder.shipping) === 0 ? 'Free' : rupees(safeOrder.shipping)}\n`;
    message += `Total: ${rupees(safeOrder.total)}\n\n`;

    message += `Payment Status: ${safeOrder.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}\n`;
    message += 'Online payment is coming soon, so payment arrangements still need to be confirmed with us.\n\n';

    message += 'Please confirm the availability of these items and the delivery details. Thank you!';

    return message;
}

export { buildWhatsAppUrl, buildGuestOrderMessage, formatAddressLines, rupees };
