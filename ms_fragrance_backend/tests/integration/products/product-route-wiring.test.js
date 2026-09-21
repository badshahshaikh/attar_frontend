import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { createContainer } from '../../../src/composition/container.js';
import { authenticate } from '../../../src/shared/middleware/authenticate.js';
import { config } from '../../../src/config/env.js';

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
