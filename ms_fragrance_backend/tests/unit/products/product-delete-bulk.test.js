import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import DeleteProductsUseCase from '../../../src/modules/products/application/use-cases/DeleteProductsUseCase.js';
import { parseProductIdList } from '../../../src/modules/products/product.validator.js';
import { createProductController } from '../../../src/modules/products/product.controller.js';
import { createContainer } from '../../../src/composition/container.js';
import { authenticate } from '../../../src/shared/middleware/authenticate.js';
import { config } from '../../../src/config/env.js';
import ValidationError from '../../../src/core/errors/ValidationError.js';

function createRes() {
    const res = {
        statusCode: 200,
        body: null,
        status(code) {
            res.statusCode = code;
            return res;
        },
        json(payload) {
            res.body = payload;
            return res;
        },
    };
    return res;
}

function createFakeRepository({ imageRows = [], deletedIds = [] } = {}) {
    const calls = {};
    return {
        calls,
        findImagesByIds: async (ids, client) => {
            calls.findImagesIds = ids;
            calls.findImagesClient = client;
            return imageRows.filter((row) => ids.includes(row.id));
        },
        deleteProductsByIds: async (ids, client) => {
            calls.deleteIds = ids;
            calls.deleteClient = client;
            return deletedIds.filter((id) => ids.includes(id));
        },
    };
}

test('parseProductIdList validates, dedupes and preserves the submitted order', () => {
    assert.deepEqual(parseProductIdList(['3', 1, '1', 2]), [3, 1, 2]);
});

test('parseProductIdList rejects invalid payloads with a ValidationError', () => {
    assert.throws(() => parseProductIdList(undefined), ValidationError);
    assert.throws(() => parseProductIdList('1,2,3'), ValidationError);
    assert.throws(() => parseProductIdList([]), ValidationError);
    assert.throws(() => parseProductIdList([0]), ValidationError);
    assert.throws(() => parseProductIdList([-5]), ValidationError);
    assert.throws(() => parseProductIdList([1.5]), ValidationError);
    assert.throws(() => parseProductIdList(['abc']), ValidationError);
    assert.throws(() => parseProductIdList([null]), ValidationError);
    assert.throws(() => parseProductIdList(new Array(501).fill(1)), ValidationError);
});

test('DeleteProductsUseCase deletes only the submitted ids inside a single transaction', async () => {
    const repository = createFakeRepository({
        imageRows: [
            { id: 1, image_url: '/images/a.jpg', image_urls: ['/images/a2.jpg'] },
            { id: 999, image_url: '/images/other.jpg', image_urls: [] },
        ],
        deletedIds: [1, 2],
    });
    const transactionClients = [];
    const useCase = new DeleteProductsUseCase(repository, null, async (callback) => {
        const client = { tag: 'tx-client' };
        transactionClients.push(client);
        return callback(client);
    });

    const result = await useCase.execute([1, 2, 3]);

    assert.equal(transactionClients.length, 1, 'one transaction for the whole batch');
    assert.deepEqual(repository.calls.findImagesIds, [1, 2, 3]);
    assert.deepEqual(repository.calls.deleteIds, [1, 2, 3], 'repository only receives the requested ids');
    assert.equal(repository.calls.deleteClient, transactionClients[0], 'repository runs on the transaction client');
    assert.deepEqual([...result.deletedIds].sort(), [1, 2]);
    assert.equal(result.deletedCount, 2);
    assert.deepEqual(result.notFoundIds, [3]);
});

test('DeleteProductsUseCase de-duplicates the id list before hitting the database', async () => {
    const repository = createFakeRepository({ deletedIds: [5] });
    const useCase = new DeleteProductsUseCase(repository, null, async (callback) => callback('tx'));

    const result = await useCase.execute([5, 5, 5]);

    assert.deepEqual(repository.calls.deleteIds, [5]);
    assert.deepEqual(result.deletedIds, [5]);
    assert.equal(result.deletedCount, 1);
    assert.deepEqual(result.notFoundIds, []);
});

test('DeleteProductsUseCase reports a complete miss without failing', async () => {
    const repository = createFakeRepository({ deletedIds: [] });
    const useCase = new DeleteProductsUseCase(repository, null, async (callback) => callback('tx'));

    const result = await useCase.execute([42]);

    assert.deepEqual(result.deletedIds, []);
    assert.equal(result.deletedCount, 0);
    assert.deepEqual(result.notFoundIds, [42]);
});

test('DeleteProductsUseCase propagates a failed transaction rollback', async () => {
    const repository = {
        findImagesByIds: async () => [],
        deleteProductsByIds: async () => {
            throw new Error('connection lost');
        },
    };
    const useCase = new DeleteProductsUseCase(repository, null, async (callback) => callback('tx'));

    await assert.rejects(() => useCase.execute([1]), /connection lost/);
});

test('controller.bulkDelete validates ids, calls the use case and returns the result', async () => {
    let received;
    const controller = createProductController({
        deleteProductsUseCase: {
            execute: async (ids) => {
                received = ids;
                return { deletedIds: [7, 8], deletedCount: 2, notFoundIds: [9] };
            },
        },
    });
    const res = createRes();

    await controller.bulkDelete({ body: { ids: ['7', 8, '8', '9'] } }, res);

    assert.deepEqual(received, [7, 8, 9], 'ids are validated, deduped integers');
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.deletedIds, [7, 8]);
    assert.equal(res.body.deletedCount, 2);
    assert.deepEqual(res.body.notFoundIds, [9]);
    assert.match(res.body.message, /not found/);
});

test('controller.bulkDelete rejects invalid id payloads with 400 and never calls the use case', async () => {
    let called = false;
    const controller = createProductController({
        deleteProductsUseCase: {
            execute: async () => {
                called = true;
                return { deletedIds: [], deletedCount: 0, notFoundIds: [] };
            },
        },
    });

    for (const body of [{}, { ids: [] }, { ids: 'nope' }, { ids: [0, -1] }, { ids: ['abc'] }]) {
        const res = createRes();
        await controller.bulkDelete({ body }, res);
        assert.equal(res.statusCode, 400, `400 for ${JSON.stringify(body)}`);
        assert.ok(res.body.error, 'a clear error message is returned');
    }
    assert.equal(called, false, 'the use case must not run on invalid input');
});

function bulkDeleteRouteHandlers() {
    const { productRouter } = createContainer();
    const routeLayer = productRouter.stack.find(
        (layer) => layer.route?.path === '/bulk' && layer.route.methods.delete
    );

    assert.ok(routeLayer, 'DELETE /bulk route is registered');

    return routeLayer.route.stack.map((layer) => layer.handle);
}

test('DELETE /bulk is wired to authentication and an admin role gate before the controller', () => {
    const handlers = bulkDeleteRouteHandlers();

    assert.equal(handlers[0], authenticate, 'authenticate runs first');
    assert.equal(handlers.length, 3, 'authenticate -> role gate -> controller');
    assert.equal(typeof handlers[1], 'function', 'a role gate sits between authenticate and the controller');
    assert.equal(typeof handlers[2], 'function', 'the controller handler is registered last');
});

test('DELETE /bulk is registered before DELETE /:id so it is never swallowed by the param route', () => {
    const { productRouter } = createContainer();
    const deletePaths = productRouter.stack
        .filter((layer) => layer.route?.methods.delete)
        .map((layer) => layer.route.path);

    const bulkIndex = deletePaths.indexOf('/bulk');
    const paramIndex = deletePaths.indexOf('/:id');

    assert.ok(bulkIndex !== -1, 'the /bulk route exists');
    assert.ok(paramIndex !== -1, 'the /:id route exists');
    assert.ok(bulkIndex < paramIndex, '/bulk must be matched before /:id');
});

test('a customer JWT is rejected with 403 and never reaches the bulk delete controller', () => {
    const [authenticateMw, roleGate] = bulkDeleteRouteHandlers();
    const token = jwt.sign({ id: 5, email: 'shopper@example.com', role: 'customer' }, config.auth.jwtSecret);
    const req = { method: 'DELETE', originalUrl: '/api/products/bulk', cookies: { [config.auth.cookie.name]: token } };
    const res = createRes();

    let reachedController = false;
    authenticateMw(req, res, () => roleGate(req, res, () => {
        reachedController = true;
    }));

    assert.equal(reachedController, false, 'the controller must not run for a customer');
    assert.equal(res.statusCode, 403);
});

test('an admin JWT reaches the bulk delete controller', () => {
    const [authenticateMw, roleGate] = bulkDeleteRouteHandlers();
    const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, config.auth.jwtSecret);
    const req = { method: 'DELETE', originalUrl: '/api/products/bulk', cookies: { [config.auth.cookie.name]: token } };
    const res = createRes();

    let reachedController = false;
    authenticateMw(req, res, () => roleGate(req, res, () => {
        reachedController = true;
    }));

    assert.equal(reachedController, true, 'an admin should reach the handler');
    assert.equal(res.statusCode, 200);
});