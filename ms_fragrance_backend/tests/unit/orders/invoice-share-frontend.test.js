import test from 'node:test';
import assert from 'node:assert/strict';

// invoiceShare.js (frontend) mirrors the backend phone/message rules so the
// admin panel can validate before hitting the network. Kept in a plain ES
// module so it runs from Node like the other pure frontend utilities.
import {
    normalizeWhatsAppPhone,
    buildInvoiceShareMessage,
    buildWhatsAppInvoiceUrl,
} from '../../../../src/features/admin/orders/utils/invoiceShare.js';

test('frontend normalisation prefixes a bare Indian mobile once', () => {
    assert.deepEqual(normalizeWhatsAppPhone('9876543210'), { valid: true, e164: '919876543210' });
    assert.deepEqual(normalizeWhatsAppPhone('919876543210'), { valid: true, e164: '919876543210' });
});

test('frontend normalisation preserves international codes and rejects bad input', () => {
    assert.deepEqual(normalizeWhatsAppPhone('+14155552671'), { valid: true, e164: '14155552671' });

    for (const raw of ['', null, 'abc', '123']) {
        const result = normalizeWhatsAppPhone(raw);
        assert.equal(result.valid, false);
        assert.ok(result.reason);
    }
});

test('frontend share message and wa.me URL match the spec wording', () => {
    const message = buildInvoiceShareMessage({
        customerName: 'Aisha Khan',
        orderNumber: 'MSF-261005-AB12',
        orderStatus: 'shipped',
        paymentStatus: 'unpaid',
    });

    assert.match(message, /Hello Aisha Khan, thank you for shopping with MS Fragrances\./);
    assert.match(message, /Please find your invoice for order MSF-261005-AB12 attached\./);
    assert.match(message, /Order status: Shipped\. Payment status: Unpaid\./);
    assert.match(message, /Please contact us if you need any assistance\./);

    const url = buildWhatsAppInvoiceUrl('919876543210', message);
    assert.ok(url.startsWith('https://wa.me/919876543210?text='));
    assert.ok(url.includes(encodeURIComponent(message)));
});
