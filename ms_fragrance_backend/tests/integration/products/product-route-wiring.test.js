const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { createContainer } = require('../../../src/composition/container');
const { authenticate } = require('../../../src/shared/middleware/authenticate');
const { config } = require('../../../src/config/env');

test('container wires the PUT route to authentication before the controller handler', () => {
    const { productRouter } = createContainer();
    const routeLayer = productRouter.stack.find(layer => layer.route?.path === '/:id' && layer.route.methods.put);
    assert.ok(routeLayer, 'PUT /:id route is registered');
    assert.equal(routeLayer.route.stack[0].handle, authenticate);
    assert.equal(typeof routeLayer.route.stack[1].handle, 'function');
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
