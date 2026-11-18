import test from 'node:test';
import assert from 'node:assert/strict';
import NotFoundError from '../../../src/core/errors/NotFoundError.js';
import { createProductController } from '../../../src/modules/products/product.controller.js';

function response() {
    return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('controller calls activateProductUseCase and returns activated product', async () => {
    const activatedProduct = { id: 7, name: 'Verification Attar', inStock: true };
    let receivedId;
    const controller = createProductController({
        activateProductUseCase: {
            execute: async (id) => {
                receivedId = id;
                return activatedProduct;
            }
        }
    });
    const req = { params: { id: '7' } };
    const res = response();

    await controller.activate(req, res);

    assert.equal(receivedId, 7);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, activatedProduct);
});

test('controller calls deactivateProductUseCase and returns deactivated product', async () => {
    const deactivatedProduct = { id: 7, name: 'Verification Attar', inStock: false };
    let receivedId;
    const controller = createProductController({
        deactivateProductUseCase: {
            execute: async (id) => {
                receivedId = id;
                return deactivatedProduct;
            }
        }
    });
    const req = { params: { id: '7' } };
    const res = response();

    await controller.deactivate(req, res);

    assert.equal(receivedId, 7);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, deactivatedProduct);
});

test('controller rejects invalid product ID for activate', async () => {
    const controller = createProductController({
        activateProductUseCase: {
            execute: async () => { throw new Error('should not be called'); }
        }
    });
    const req = { params: { id: '0' } };
    const res = response();

    await controller.activate(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /positive integer/);
});

test('controller rejects invalid product ID for deactivate', async () => {
    const controller = createProductController({
        deactivateProductUseCase: {
            execute: async () => { throw new Error('should not be called'); }
        }
    });
    const req = { params: { id: 'abc' } };
    const res = response();

    await controller.deactivate(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /positive integer/);
});

test('controller returns 404 when product not found for activate', async () => {
    const controller = createProductController({
        activateProductUseCase: {
            execute: async () => { throw new NotFoundError('Product with ID 999 not found'); }
        }
    });
    const req = { params: { id: '999' } };
    const res = response();

    await controller.activate(req, res);

    assert.equal(res.statusCode, 404);
    assert.match(res.body.error, /not found/i);
});

test('controller returns 404 when product not found for deactivate', async () => {
    const controller = createProductController({
        deactivateProductUseCase: {
            execute: async () => { throw new NotFoundError('Product with ID 999 not found'); }
        }
    });
    const req = { params: { id: '999' } };
    const res = response();

    await controller.deactivate(req, res);

    assert.equal(res.statusCode, 404);
    assert.match(res.body.error, /not found/i);
});
