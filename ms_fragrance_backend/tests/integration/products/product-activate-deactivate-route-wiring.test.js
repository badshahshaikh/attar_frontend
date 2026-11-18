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
        status(code) { res.statusCode = code; return res; },
        json(payload) { res.body = payload; return res; },
    };
    return res;
}

function activateRouteHandlers() {
    const { productRouter } = createContainer();
    const routeLayer = productRouter.stack.find(
        layer => layer.route?.path === '/:id/activate' && layer.route.methods.patch
    );
    assert.ok(routeLayer, 'PATCH /:id/activate route is registered');
    return routeLayer.route.stack.map(layer => layer.handle);
}

function deactivateRouteHandlers() {
    const { productRouter } = createContainer();
    const routeLayer = productRouter.stack.find(
        layer => layer.route?.path === '/:id/deactivate' && layer.route.methods.patch
    );
    assert.ok(routeLayer, 'PATCH /:id/deactivate route is registered');
    return routeLayer.route.stack.map(layer => layer.handle);
}

test('container wires the PATCH /:id/activate route to authentication and admin role gate', () => {
    const handlers = activateRouteHandlers();
    assert.equal(handlers[0], authenticate, 'authenticate runs first');
    assert.equal(handlers.length, 3, 'authenticate -> role gate -> controller');
    assert.equal(typeof handlers[1], 'function', 'a role gate sits between authenticate and the controller');
    assert.equal(typeof handlers[2], 'function', 'the controller handler is registered last');
});

test('container wires the PATCH /:id/deactivate route to authentication and admin role gate', () => {
    const handlers = deactivateRouteHandlers();
    assert.equal(handlers[0], authenticate, 'authenticate runs first');
    assert.equal(handlers.length, 3, 'authenticate -> role gate -> controller');
    assert.equal(typeof handlers[1], 'function', 'a role gate sits between authenticate and the controller');
    assert.equal(typeof handlers[2], 'function', 'the controller handler is registered last');
});

test('an admin JWT passes authentication and the role gate for activate', () => {
    const [authenticateMw, roleGate] = activateRouteHandlers();
    const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, config.auth.jwtSecret);
    const req = { method: 'PATCH', originalUrl: '/api/products/7/activate', cookies: { [config.auth.cookie.name]: token } };
    const res = createRes();

    let reachedController = false;
    authenticateMw(req, res, () => roleGate(req, res, () => { reachedController = true; }));

    assert.equal(reachedController, true, 'the controller should be reachable for an admin');
    assert.equal(res.statusCode, null);
});

test('an admin JWT passes authentication and the role gate for deactivate', () => {
    const [authenticateMw, roleGate] = deactivateRouteHandlers();
    const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, config.auth.jwtSecret);
    const req = { method: 'PATCH', originalUrl: '/api/products/7/deactivate', cookies: { [config.auth.cookie.name]: token } };
    const res = createRes();

    let reachedController = false;
    authenticateMw(req, res, () => roleGate(req, res, () => { reachedController = true; }));

    assert.equal(reachedController, true, 'the controller should be reachable for an admin');
    assert.equal(res.statusCode, null);
});

test('a customer JWT is rejected with 403 for activate', () => {
    const [authenticateMw, roleGate] = activateRouteHandlers();
    const token = jwt.sign({ id: 5, email: 'shopper@example.com', role: 'customer' }, config.auth.jwtSecret);
    const req = { method: 'PATCH', originalUrl: '/api/products/7/activate', cookies: { [config.auth.cookie.name]: token } };
    const res = createRes();

    let reachedController = false;
    authenticateMw(req, res, () => roleGate(req, res, () => { reachedController = true; }));

    assert.equal(reachedController, false, 'the controller must not run for a customer');
    assert.equal(res.statusCode, 403);
});

test('a customer JWT is rejected with 403 for deactivate', () => {
    const [authenticateMw, roleGate] = deactivateRouteHandlers();
    const token = jwt.sign({ id: 5, email: 'shopper@example.com', role: 'customer' }, config.auth.jwtSecret);
    const req = { method: 'PATCH', originalUrl: '/api/products/7/deactivate', cookies: { [config.auth.cookie.name]: token } };
    const res = createRes();

    let reachedController = false;
    authenticateMw(req, res, () => roleGate(req, res, () => { reachedController = true; }));

    assert.equal(reachedController, false, 'the controller must not run for a customer');
    assert.equal(res.statusCode, 403);
});

test('an unauthenticated request is rejected with 401 for activate', () => {
    const [authenticateMw] = activateRouteHandlers();
    const req = { method: 'PATCH', originalUrl: '/api/products/7/activate', cookies: {} };
    const res = createRes();

    let reachedNext = false;
    authenticateMw(req, res, () => { reachedNext = true; });

    assert.equal(reachedNext, false, 'no cookie means authenticate rejects first');
    assert.equal(res.statusCode, 401);
});

test('an unauthenticated request is rejected with 401 for deactivate', () => {
    const [authenticateMw] = deactivateRouteHandlers();
    const req = { method: 'PATCH', originalUrl: '/api/products/7/deactivate', cookies: {} };
    const res = createRes();

    let reachedNext = false;
    authenticateMw(req, res, () => { reachedNext = true; });

    assert.equal(reachedNext, false, 'no cookie means authenticate rejects first');
    assert.equal(res.statusCode, 401);
});
