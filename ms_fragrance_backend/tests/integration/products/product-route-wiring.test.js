import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { createContainer } from '../../../src/composition/container.js';
import { authenticate } from '../../../src/shared/middleware/authenticate.js';
import { config } from '../../../src/config/env.js';

function createRes() {
    const res = {
        statusCode: null,
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

function putRouteHandlers() {
    const { productRouter } = createContainer();
    const routeLayer = productRouter.stack.find(
        layer => layer.route?.path === '/:id' && layer.route.methods.put
    );

    assert.ok(routeLayer, 'PUT /:id route is registered');

    return routeLayer.route.stack.map(layer => layer.handle);
}

test('container wires the PUT route to authentication and an admin role gate before the controller', () => {
    const handlers = putRouteHandlers();

    assert.equal(handlers[0], authenticate, 'authenticate runs first');
    assert.equal(handlers.length, 3, 'authenticate -> role gate -> controller');
    assert.equal(typeof handlers[1], 'function', 'a role gate sits between authenticate and the controller');
    assert.equal(typeof handlers[2], 'function', 'the controller handler is registered last');
});

test('a valid admin JWT passes both the authentication and the role gate', () => {
    const [authenticateMw, roleGate] = putRouteHandlers();
    const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, config.auth.jwtSecret);
    const req = { method: 'PUT', originalUrl: '/api/products/7', cookies: { [config.auth.cookie.name]: token } };
    const res = createRes();

    let reachedController = false;
    authenticateMw(req, res, () => roleGate(req, res, () => {
        reachedController = true;
    }));

    assert.equal(reachedController, true, 'the controller should be reachable for an admin');
    assert.equal(res.statusCode, null);
});

test('a customer JWT is rejected with 403 and never reaches the product controller', () => {
    const [authenticateMw, roleGate] = putRouteHandlers();
    const token = jwt.sign({ id: 5, email: 'shopper@example.com', role: 'customer' }, config.auth.jwtSecret);
    const req = { method: 'PUT', originalUrl: '/api/products/7', cookies: { [config.auth.cookie.name]: token } };
    const res = createRes();

    let reachedController = false;
    authenticateMw(req, res, () => roleGate(req, res, () => {
        reachedController = true;
    }));

    assert.equal(reachedController, false, 'the controller must not run for a customer');
    assert.equal(res.statusCode, 403);
});

test('a valid JWT cookie reaches the next PUT handler with its user payload', () => {
    const token = jwt.sign({ id: 7, username: 'tester', role: 'admin' }, config.auth.jwtSecret);
    const req = { cookies: { [config.auth.cookie.name]: token } };
    const res = { status: () => res, json: body => { throw new Error(`Authentication unexpectedly rejected: ${JSON.stringify(body)}`); } };
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.deepEqual(req.user.id, 7);
});

test('a customer JWT without a username still authenticates', () => {
    const token = jwt.sign({ id: 8, email: 'shopper@example.com', role: 'customer' }, config.auth.jwtSecret);
    const req = { cookies: { [config.auth.cookie.name]: token } };
    const res = { status: () => res, json: () => res };
    let nextCalled = false;

    authenticate(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true, 'username must no longer be required in the JWT payload');
    assert.equal(req.user.role, 'customer');
});
