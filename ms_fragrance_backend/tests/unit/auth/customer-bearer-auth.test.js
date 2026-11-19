import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { authenticateCustomer } from '../../../src/shared/middleware/authenticate.js';
import { createAuthController } from '../../../src/modules/auth/auth.controller.js';
import { config } from '../../../src/config/env.js';

function createRes() {
    const res = {
        statusCode: null,
        body: null,
        headers: {},
        cookies: {},
        status(code) {
            res.statusCode = code;
            return res;
        },
        json(payload) {
            res.body = payload;
            return res;
        },
        setHeader(key, value) {
            res.headers[key] = value;
            return res;
        },
        cookie(name, value, options) {
            res.cookies[name] = { value, options };
            return res;
        },
    };
    return res;
}

test('authenticateCustomer accepts valid Bearer token in Authorization header when cookie is missing', () => {
    const token = jwt.sign({ id: 55, email: 'bearer-customer@example.com', role: 'customer' }, config.auth.jwtSecret);
    const req = { cookies: {}, headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    let nextCalled = false;

    authenticateCustomer(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true, 'next() should be called when valid customer Bearer token is provided');
    assert.equal(req.customer.id, 55);
    assert.equal(req.customer.email, 'bearer-customer@example.com');
    assert.equal(req.customer.role, 'customer');
    assert.equal(res.statusCode, null);
});

test('authenticateCustomer prefers cookie token over Bearer token when both are present', () => {
    const cookieToken = jwt.sign({ id: 101, email: 'cookie@example.com', role: 'customer' }, config.auth.jwtSecret);
    const bearerToken = jwt.sign({ id: 202, email: 'bearer@example.com', role: 'customer' }, config.auth.jwtSecret);
    const req = {
        cookies: { [config.auth.customerCookie.name]: cookieToken },
        headers: { authorization: `Bearer ${bearerToken}` },
    };
    const res = createRes();
    let nextCalled = false;

    authenticateCustomer(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.customer.id, 101, 'cookie token should take precedence over bearer token');
    assert.equal(res.statusCode, null);
});

test('authenticateCustomer rejects non-customer Bearer token with 401', () => {
    const adminToken = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, config.auth.jwtSecret);
    const req = { cookies: {}, headers: { authorization: `Bearer ${adminToken}` } };
    const res = createRes();
    let nextCalled = false;

    authenticateCustomer(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
});

test('authenticateCustomer rejects expired Bearer token with 401', () => {
    const expiredToken = jwt.sign(
        { id: 42, email: 'expired@example.com', role: 'customer' },
        config.auth.jwtSecret,
        { expiresIn: '0s' }
    );
    const req = { cookies: {}, headers: { authorization: `Bearer ${expiredToken}` } };
    const res = createRes();
    let nextCalled = false;

    authenticateCustomer(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
});

test('authenticateCustomer rejects malformed Bearer token with 401', () => {
    const req = { cookies: {}, headers: { authorization: 'Bearer this.is.invalid' } };
    const res = createRes();
    let nextCalled = false;

    authenticateCustomer(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
});

test('authenticateCustomer safely handles missing headers and cookies without throwing', () => {
    const req = {};
    const res = createRes();
    let nextCalled = false;

    assert.doesNotThrow(() => {
        authenticateCustomer(req, res, () => {
            nextCalled = true;
        });
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
});

test('authController.customerLogin returns token in JSON response payload', async () => {
    const dummyToken = 'jwt-dummy-token-for-customer';
    const mockAuthService = {
        customerLogin: async () => ({
            user: { id: 7, email: 'zoya@example.com', fullName: 'Zoya', role: 'customer' },
            token: dummyToken,
        }),
    };
    const controller = createAuthController({ authService: mockAuthService });
    const req = { body: { email: 'zoya@example.com', password: 'ValidPassword123!' } };
    const res = createRes();

    await controller.customerLogin(req, res);

    assert.equal(res.body.success, true);
    assert.equal(res.body.user.id, 7);
    assert.equal(res.body.token, dummyToken, 'customerLogin must include result.token in response JSON');
});

test('authController.customerRegister returns token in JSON response payload', async () => {
    const dummyToken = 'jwt-dummy-register-token';
    const mockAuthService = {
        register: async () => ({
            user: { id: 8, email: 'new@example.com', fullName: 'New User', role: 'customer' },
            token: dummyToken,
        }),
    };
    const controller = createAuthController({ authService: mockAuthService });
    const req = {
        body: {
            fullName: 'New User',
            email: 'new@example.com',
            password: 'ValidPassword123!',
            phone: '9876543210',
        },
    };
    const res = createRes();

    await controller.customerRegister(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.id, 8);
    assert.equal(res.body.token, dummyToken, 'customerRegister must include result.token in response JSON');
});
