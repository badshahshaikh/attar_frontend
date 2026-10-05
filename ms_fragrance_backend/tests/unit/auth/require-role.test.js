import test from 'node:test';
import assert from 'node:assert/strict';

import { requireRole } from '../../../src/shared/middleware/require-role.js';

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

test('requireRole passes an admin through to the next handler', () => {
    const middleware = requireRole('admin');
    const req = { user: { id: 1, role: 'admin' }, method: 'POST', originalUrl: '/api/products' };
    const res = createRes();
    let nextCalled = false;

    middleware(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null);
});

test('requireRole rejects an authenticated customer with 403', () => {
    const middleware = requireRole('admin');
    const req = { user: { id: 2, role: 'customer' }, method: 'POST', originalUrl: '/api/products' };
    const res = createRes();
    let nextCalled = false;

    middleware(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
});

test('requireRole fails closed when authentication did not populate req.user', () => {
    const middleware = requireRole('admin');
    const req = { method: 'DELETE', originalUrl: '/api/products/9' };
    const res = createRes();
    let nextCalled = false;

    middleware(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
});

test('requireRole accepts any role listed in the allow list', () => {
    const middleware = requireRole('admin', 'staff');
    const res = createRes();
    let nextCalled = false;

    middleware({ user: { id: 3, role: 'staff' }, method: 'GET', originalUrl: '/x' }, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null);
});