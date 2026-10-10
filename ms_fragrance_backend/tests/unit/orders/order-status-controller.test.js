import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { createOrdersController } from '../../../src/modules/orders/orders.controller.js';
import { createOrdersContainer } from '../../../src/modules/orders/orders.container.js';
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

function controllerWith(updateOrderStatusUseCase) {
    return createOrdersController({ getOrdersUseCase: {}, getOrderByIdUseCase: {}, updateOrderStatusUseCase });
}

// ── Controller: 200 / 400 / 404 behaviour ─────────────────────────────────
test('controller returns 200 with the updated order', async () => {
    const controller = controllerWith({
        execute: async () => ({ id: 7, orderNumber: 'MSF-1', status: 'shipped', paymentStatus: 'unpaid' }),
    });

    const res = createRes();
    await controller.updateStatus({ params: { id: '7' }, body: { status: 'shipped' } }, res);

    // Success uses res.json directly (Express defaults to 200), so no explicit
    // error status is set here.
    assert.ok(res.statusCode === null || res.statusCode === 200);
    assert.equal(res.body.order.status, 'shipped');
    assert.equal(res.body.error, undefined);
});

test('controller returns 400 for an invalid status value', async () => {
    const controller = controllerWith({ execute: async () => { throw new Error('should not be called'); } });

    const res = createRes();
    await controller.updateStatus({ params: { id: '7' }, body: { status: 'nope' } }, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Invalid status/i);
});

test('controller returns 400 for an empty body or both fields at once', async () => {
    const controller = controllerWith({ execute: async () => { throw new Error('should not be called'); } });

    const empty = createRes();
    await controller.updateStatus({ params: { id: '7' }, body: {} }, empty);
    assert.equal(empty.statusCode, 400);

    const both = createRes();
    await controller.updateStatus({ params: { id: '7' }, body: { status: 'shipped', paymentStatus: 'paid' } }, both);
    assert.equal(both.statusCode, 400);
    assert.match(both.body.error, /one field at a time/i);
});

test('controller returns 400 for an invalid order id', async () => {
    const controller = controllerWith({ execute: async () => { throw new Error('should not be called'); } });

    const res = createRes();
    await controller.updateStatus({ params: { id: '0' }, body: { status: 'shipped' } }, res);
    assert.equal(res.statusCode, 400);
});

test('controller returns 404 when the order does not exist', async () => {
    const controller = controllerWith({ execute: async () => null });

    const res = createRes();
    await controller.updateStatus({ params: { id: '999' }, body: { status: 'shipped' } }, res);
    assert.equal(res.statusCode, 404);
    assert.match(res.body.error, /not found/i);
});

// ── Route wiring: authentication + admin role gate ────────────────────────
function statusRouteHandlers() {
    const { ordersRouter } = createOrdersContainer({
        orderRepository: {
            findAllAdmin: async () => ({ rows: [], total: 0 }),
            findByIdAdmin: async () => null,
            updateOrderStatus: async () => null,
        },
    });
    const layer = ordersRouter.stack.find(
        l => l.route?.path === '/:id/status' && l.route.methods.patch
    );
    assert.ok(layer, 'PATCH /:id/status route is registered');
    return layer.route.stack.map(l => l.handle);
}

test('the status route is gated by authenticate + admin role before the controller', () => {
    const handlers = statusRouteHandlers();

    assert.equal(handlers[0], authenticate, 'authenticate runs first');
    assert.equal(handlers.length, 3, 'authenticate -> role gate -> controller');
    assert.equal(typeof handlers[1], 'function', 'a role gate sits between authenticate and the controller');
    assert.equal(typeof handlers[2], 'function', 'the controller handler is registered last');
});

test('an admin JWT passes authentication and the role gate', () => {
    const [authenticateMw, roleGate] = statusRouteHandlers();
    const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, config.auth.jwtSecret);
    const req = { method: 'PATCH', originalUrl: '/api/orders/7/status', cookies: { [config.auth.cookie.name]: token } };
    const res = createRes();

    let reachedController = false;
    authenticateMw(req, res, () => roleGate(req, res, () => { reachedController = true; }));

    assert.equal(reachedController, true, 'the controller is reachable for an admin');
    assert.equal(res.statusCode, null);
});

test('an unauthenticated request is rejected with 401 and never reaches the controller', () => {
    const [authenticateMw] = statusRouteHandlers();
    const req = { method: 'PATCH', originalUrl: '/api/orders/7/status', cookies: {} };
    const res = createRes();

    let reachedNext = false;
    authenticateMw(req, res, () => { reachedNext = true; });

    assert.equal(reachedNext, false, 'no cookie means authenticate rejects first');
    assert.equal(res.statusCode, 401);
});

test('a customer (non-admin) JWT is rejected with 403 and never reaches the controller', () => {
    const [authenticateMw, roleGate] = statusRouteHandlers();
    const token = jwt.sign({ id: 5, email: 'shopper@example.com', role: 'customer' }, config.auth.jwtSecret);
    const req = { method: 'PATCH', originalUrl: '/api/orders/7/status', cookies: { [config.auth.cookie.name]: token } };
    const res = createRes();

    let reachedController = false;
    authenticateMw(req, res, () => roleGate(req, res, () => { reachedController = true; }));

    assert.equal(reachedController, false, 'the controller must not run for a customer');
    assert.equal(res.statusCode, 403);
});
