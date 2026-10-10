import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Controller `invoice` action: 400 on a bad id, 404 on a missing order, a real
// application/pdf download with the filename on success, and no stack-trace
// leakage on failure.
import { createOrdersController } from '../../../src/modules/orders/orders.controller.js';

function createRes() {
    const res = {
        statusCode: null,
        headers: {},
        body: null,
        status(code) { res.statusCode = code; return res; },
        json(payload) { res.body = payload; return res; },
        setHeader(name, value) { res.headers[name] = value; },
        send(payload) { res.body = payload; return res; },
    };
    return res;
}

function controllerWith(generateInvoiceUseCase) {
    return createOrdersController({
        getOrdersUseCase: {},
        getOrderByIdUseCase: {},
        updateOrderStatusUseCase: {},
        generateInvoiceUseCase,
    });
}

const PDF = Buffer.from('%PDF-1.4 invoice');

test('streams the PDF download with a descriptive filename', async () => {
    const controller = controllerWith({
        execute: async (id) => {
            assert.equal(id, 7);
            return { pdf: PDF, filename: 'MS-Fragrances-Invoice-MSF-1.pdf' };
        },
    });

    const res = createRes();
    await controller.invoice({ params: { id: '7' } }, res);

    assert.ok(res.statusCode === null || res.statusCode === 200);
    assert.equal(res.headers['Content-Type'], 'application/pdf');
    assert.match(res.headers['Content-Disposition'], /MS-Fragrances-Invoice-MSF-1\.pdf/);
    assert.equal(res.body, PDF);
});

test('returns 400 for an invalid order id', async () => {
    const controller = controllerWith({ execute: async () => { throw new Error('must not be called'); } });

    const res = createRes();
    await controller.invoice({ params: { id: '0' } }, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /positive integer/i);
});

test('returns 404 when the order does not exist', async () => {
    const controller = controllerWith({ execute: async () => null });

    const res = createRes();
    await controller.invoice({ params: { id: '999' } }, res);

    assert.equal(res.statusCode, 404);
    assert.match(res.body.error, /not found/i);
});

test('does not leak stack traces on unexpected failures', async () => {
    const controller = controllerWith({
        execute: async () => {
            const error = new Error('db exploded: password=secret stack...');
            throw error;
        },
    });

    const res = createRes();
    await controller.invoice({ params: { id: '7' } }, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'Failed to generate invoice');
    assert.ok(!JSON.stringify(res.body).includes('secret'));
});
