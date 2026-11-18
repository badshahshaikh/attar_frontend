import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductController } from '../../../src/modules/products/product.controller.js';

function response() {
    return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('controller passes the validated PUT body to the service and returns its mapped product', async () => {
    let received;
    const controller = createProductController({
        updateProductUseCase: {
            execute: async (id, payload) => {
                received = { id, payload };
                return { product: { id, name: payload.name }, imageChanged: false };
            }
        }
    });
    const req = { params: { id: '42' }, body: { name: 'Verification Attar', price: '99', brand: 'Surrati', fragranceFamily: 'Oud', sizes: [], sizePricing: {}, topNotes: [], heartNotes: [], baseNotes: [] } };
    const res = response();

    await controller.update(req, res);

    assert.equal(received.id, 42);
    assert.equal(received.payload.name, 'Verification Attar');
    assert.equal(received.payload.fragranceFamily, 'Oud');
    assert.equal(received.payload.price, '99');
    assert.deepEqual(received.payload.sizePricing, {});
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { id: 42, name: 'Verification Attar' });
});
