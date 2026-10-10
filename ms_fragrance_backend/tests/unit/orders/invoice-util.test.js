import test from 'node:test';
import assert from 'node:assert/strict';

// invoice.util.js is a pure ES module (no I/O, no framework deps), exercised
// directly from Node like the other pure feature utilities. These pin invoice
// numbering, filenames, INR formatting, phone normalisation, the share message
// and wa.me URL encoding.
import {
    BRAND_NAME,
    invoiceNumberFor,
    invoiceFilename,
    formatINR,
    statusLabel,
    normalizeWhatsAppPhone,
    buildInvoiceShareMessage,
    buildWhatsAppInvoiceUrl,
} from '../../../src/modules/orders/invoice/invoice.util.js';

test('invoice number is a stable derivative of the order number', () => {
    assert.equal(invoiceNumberFor('MSF-261005-AB12'), 'INV-MSF-261005-AB12');
    assert.equal(invoiceNumberFor('MSF-261005-AB12'), invoiceNumberFor('MSF-261005-AB12'));
});

test('invoice filename is descriptive and filesystem-safe', () => {
    assert.equal(invoiceFilename('MSF-261005-AB12'), 'MS-Fragrances-Invoice-MSF-261005-AB12.pdf');
    assert.equal(invoiceFilename('MSF 261005/AB12'), 'MS-Fragrances-Invoice-MSF-261005-AB12.pdf');
    assert.equal(invoiceFilename(''), 'MS-Fragrances-Invoice-order.pdf');
});

test('formatINR renders Indian rupees with two decimals', () => {
    assert.equal(formatINR(648), '₹648.00');
    assert.equal(formatINR('249.5'), '₹249.50');
    assert.equal(formatINR(null), '₹0.00');
});

test('statusLabel capitalises and falls back gracefully', () => {
    assert.equal(statusLabel('shipped'), 'Shipped');
    assert.equal(statusLabel('unpaid'), 'Unpaid');
    assert.equal(statusLabel(''), 'Unknown');
});

test('normalizeWhatsAppPhone prefixes a bare Indian mobile once', () => {
    assert.deepEqual(normalizeWhatsAppPhone('9876543210'), { valid: true, e164: '919876543210' });
    assert.deepEqual(normalizeWhatsAppPhone('+91 98765 43210'), { valid: true, e164: '919876543210' });
    assert.deepEqual(normalizeWhatsAppPhone('919876543210'), { valid: true, e164: '919876543210' });
});

test('normalizeWhatsAppPhone preserves international country codes', () => {
    assert.deepEqual(normalizeWhatsAppPhone('+14155552671'), { valid: true, e164: '14155552671' });
    assert.deepEqual(normalizeWhatsAppPhone('+447911123456'), { valid: true, e164: '447911123456' });
});

test('normalizeWhatsAppPhone rejects missing or invalid numbers with a helpful reason', () => {
    for (const raw of ['', null, undefined, '   ', 'abc', '123', '987654321012345678']) {
        const result = normalizeWhatsAppPhone(raw);
        assert.equal(result.valid, false, `expected invalid for ${JSON.stringify(raw)}`);
        assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
    }
});

test('buildInvoiceShareMessage uses saved values and degrades without a name', () => {
    const message = buildInvoiceShareMessage({
        customerName: 'Aisha Khan',
        orderNumber: 'MSF-261005-AB12',
        orderStatus: 'shipped',
        paymentStatus: 'unpaid',
    });

    assert.match(message, new RegExp(`Hello Aisha Khan, thank you for shopping with ${BRAND_NAME}\\.`));
    assert.match(message, /Please find your invoice for order MSF-261005-AB12 attached\./);
    assert.match(message, /Order status: Shipped\. Payment status: Unpaid\./);
    assert.match(message, /Please contact us if you need any assistance\./);

    const nameless = buildInvoiceShareMessage({
        customerName: '',
        orderNumber: 'MSF-1',
        orderStatus: 'placed',
        paymentStatus: 'paid',
    });
    assert.match(nameless, /Hello there,/);
});

test('buildWhatsAppInvoiceUrl encodes the message as the only query param', () => {
    const url = buildWhatsAppInvoiceUrl('919876543210', 'Hello Aisha, order MSF-1 & invoice attached.');

    assert.ok(url.startsWith('https://wa.me/919876543210?text='));
    assert.ok(url.includes(encodeURIComponent('Hello Aisha, order MSF-1 & invoice attached.')));
    assert.ok(!url.includes(' '));
});
