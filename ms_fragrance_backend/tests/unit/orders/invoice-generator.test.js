import test from 'node:test';
import assert from 'node:assert/strict';

// invoice.generator.js renders the PDF with pdfkit. This pins that the output
// is a REAL pdf (magic bytes + EOF), and spot-checks that a long address and
// item names survive generation without throwing.
import { generateInvoicePdf } from '../../../src/modules/orders/invoice/invoice.generator.js';

const ORDER = {
    id: 7,
    orderNumber: 'MSF-261005-AB12',
    customerId: null,
    customerName: 'Aisha Khan',
    customerEmail: 'aisha@example.com',
    customerPhone: '9876543210',
    contactName: 'Aisha Khan',
    contactPhone: '9876543210',
    status: 'shipped',
    paymentStatus: 'unpaid',
    subtotal: 498,
    shipping: 150,
    total: 648,
    orderDate: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-05T10:00:00.000Z',
    shippingAddress: {
        fullName: 'Aisha Khan with a very long name that must wrap correctly inside the invoice layout',
        phone: '9876543210',
        line1: 'Flat 1204, Sea View Residency, 12 Carter Road, Bandra West, Near the Promenade and the Old Lighthouse Road Junction',
        line2: '',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400050',
        country: 'India',
    },
    notes: null,
    source: 'whatsapp',
    items: [
        { id: 1, productName: 'Mogra Attar with an exceptionally long product name that should wrap', size: '3ml', quantity: 2, unitPrice: 249, lineTotal: 498 },
        { id: 2, productName: 'Oud Royale', size: '6ml', quantity: 1, unitPrice: 999, lineTotal: 999 },
        { id: 3, productName: 'Rose Musk', size: '12ml', quantity: 3, unitPrice: 349, lineTotal: 1047 },
    ],
};

test('generates a real, non-empty PDF with a valid header and EOF marker', async () => {
    const pdf = await generateInvoicePdf(ORDER);

    assert.ok(Buffer.isBuffer(pdf) || pdf instanceof Uint8Array);
    assert.ok(pdf.length > 500, `expected a substantial PDF, got ${pdf.length} bytes`);
    assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-');
    assert.ok(pdf.subarray(pdf.length - 20).toString('latin1').includes('%%EOF'), 'expected an %%EOF trailer');
});

test('generates even with missing phone, email, address and notes', async () => {
    const minimal = {
        ...ORDER,
        customerEmail: '',
        customerPhone: '',
        contactPhone: '',
        shippingAddress: null,
        notes: null,
        items: [{ id: 9, productName: 'Sample', size: null, quantity: 1, unitPrice: 100, lineTotal: 100 }],
    };

    const pdf = await generateInvoicePdf(minimal);

    assert.ok(pdf.length > 500);
    assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-');
});
