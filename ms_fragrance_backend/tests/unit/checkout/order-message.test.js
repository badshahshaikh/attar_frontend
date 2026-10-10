import test from 'node:test';
import assert from 'node:assert/strict';

// orderMessage.js is a plain ES module (imports only a phone constant), so it
// is exercised directly from Node like cartReducer.js / stock.js. These pin the
// WhatsApp message text and URL built from a SAVED order response.
import {
    buildWhatsAppUrl,
    buildGuestOrderMessage,
    formatAddressLines,
    rupees,
} from '../../../../src/features/checkout/utils/orderMessage.js';

const SAVED_ORDER = {
    orderNumber: 'MSF-261005-AB12',
    subtotal: 498,
    shipping: 150,
    total: 648,
    contactName: 'Aisha Khan',
    contactPhone: '9876543210',
    paymentStatus: 'unpaid',
    shippingAddress: {
        fullName: 'Aisha Khan',
        phone: '9876543210',
        line1: '12 Carter Road',
        line2: 'Apt 4',
        city: 'Mumbai',
        state: 'MH',
        postalCode: '400050',
        country: 'India',
        email: 'aisha@example.com',
    },
    items: [
        { productName: 'Mogra Attar', size: '3ml', quantity: 2, unitPrice: 249, lineTotal: 498 },
    ],
};

test('buildGuestOrderMessage includes the order number, customer and delivery details', () => {
    const message = buildGuestOrderMessage(SAVED_ORDER);

    assert.match(message, /Order Number: MSF-261005-AB12/);
    assert.match(message, /Name: Aisha Khan/);
    assert.match(message, /Mobile: 9876543210/);
    assert.match(message, /Email: aisha@example\.com/);
    assert.match(message, /12 Carter Road, Apt 4, Mumbai, MH, 400050, India/);
});

test('buildGuestOrderMessage lists product name, size, quantity and prices', () => {
    const message = buildGuestOrderMessage(SAVED_ORDER);

    assert.match(message, /1\. Mogra Attar/);
    assert.match(message, /Size: 3ml/);
    assert.match(message, /Quantity: 2/);
    assert.match(message, /Unit Price: ₹249/);
    assert.match(message, /Item Total: ₹498/);
});

test('buildGuestOrderMessage shows subtotal, shipping and final total', () => {
    const message = buildGuestOrderMessage(SAVED_ORDER);

    assert.match(message, /Subtotal: ₹498/);
    assert.match(message, /Shipping: ₹150/);
    assert.match(message, /Total: ₹648/);
});

test('buildGuestOrderMessage states the payment status and coming-soon note', () => {
    const message = buildGuestOrderMessage(SAVED_ORDER);

    assert.match(message, /Payment Status: Unpaid/);
    assert.match(message, /Online payment is coming soon/i);
    assert.match(message, /payment arrangements still need to be confirmed/i);
});

test('buildGuestOrderMessage asks to confirm availability and delivery', () => {
    const message = buildGuestOrderMessage(SAVED_ORDER);

    assert.match(message, /confirm the availability of these items and the delivery details/i);
});

test('buildGuestOrderMessage shows Free shipping and Paid when applicable', () => {
    const paid = buildGuestOrderMessage({ ...SAVED_ORDER, shipping: 0, paymentStatus: 'paid' });

    assert.match(paid, /Shipping: Free/);
    assert.match(paid, /Payment Status: Paid/);
});

test('buildGuestOrderMessage tolerates a missing address / items without throwing', () => {
    const message = buildGuestOrderMessage({ orderNumber: 'MSF-1', items: [], total: 0 });

    assert.match(message, /Order Number: MSF-1/);
    assert.doesNotThrow(() => buildGuestOrderMessage(null));
});

test('buildWhatsAppUrl encodes the message and targets the configured number', () => {
    const url = buildWhatsAppUrl('Hello\nWorld & Co');

    assert.ok(url.startsWith('https://wa.me/917977185230?text='));
    // Newlines and ampersands are percent-encoded, not left raw in the query.
    assert.ok(url.includes('%0A'), 'newlines are encoded');
    assert.ok(url.includes('%26'), 'ampersands are encoded');
    assert.ok(!/[ &]/.test(url.split('?text=')[1]), 'no raw spaces or ampersands in the text param');
});

test('buildWhatsAppUrl never puts customer data in a non-encoded parameter', () => {
    const message = buildGuestOrderMessage(SAVED_ORDER);
    const url = buildWhatsAppUrl(message);
    const query = url.split('?text=')[1];

    // The only query parameter is text, and the customer name/phone only appear
    // inside the encoded payload (not as a separate ?name= or ?phone= param).
    assert.ok(!/name=|phone=|address=/.test(query));
    assert.equal(decodeURIComponent(query), message, 'the encoded body decodes to the exact message');
});

test('formatAddressLines and rupees render as expected', () => {
    assert.equal(
        formatAddressLines({ line1: 'A', line2: '', city: 'B', state: null, postalCode: '400050', country: 'India' }),
        'A, B, 400050, India'
    );
    assert.equal(formatAddressLines(null), '');
    assert.equal(rupees(1000), '₹1,000');
    assert.equal(rupees(0), '₹0');
});
