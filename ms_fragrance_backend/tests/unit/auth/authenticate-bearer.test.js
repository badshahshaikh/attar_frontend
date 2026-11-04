import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

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
test('authenticate accepts a valid Bearer token in Authorization header', () => {
    const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, config.auth.jwtSecret);
    const req = { cookies: {}, headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user.id, 1);
    assert.equal(req.user.role, 'admin');
    assert.equal(res.statusCode, null);
});

test('authenticate accepts a valid cookie token', () => {
    const token = jwt.sign({ id: 2, username: 'admin2', role: 'admin' }, config.auth.jwtSecret);
    const req = { cookies: { [config.auth.cookie.name]: token }, headers: {} };
    const res = createRes();
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user.id, 2);
    assert.equal(res.statusCode, null);
});

test('authenticate prefers cookie over Bearer token when both present', () => {
    const cookieToken = jwt.sign({ id: 10, username: 'cookie-user', role: 'admin' }, config.auth.jwtSecret);
    const bearerToken = jwt.sign({ id: 20, username: 'bearer-user', role: 'admin' }, config.auth.jwtSecret);
    const req = { cookies: { [config.auth.cookie.name]: cookieToken }, headers: { authorization: `Bearer ${bearerToken}` } };
    const res = createRes();
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user.id, 10, 'cookie token should take precedence');
    assert.equal(res.statusCode, null);
});

test('authenticate rejects missing token with 401', () => {
    const req = { cookies: {}, headers: {} };
    const res = createRes();
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
});

test('authenticate rejects invalid Bearer token with 401', () => {
    const req = { cookies: {}, headers: { authorization: 'Bearer invalid.token.here' } };
    const res = createRes();
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
});

test('authenticate rejects expired Bearer token with 401', () => {
    const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, config.auth.jwtSecret, { expiresIn: '0s' });
    const req = { cookies: {}, headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
});

test('authenticate rejects Bearer token with invalid payload (missing id)', () => {
    const token = jwt.sign({ username: 'admin', role: 'admin' }, config.auth.jwtSecret);
    const req = { cookies: {}, headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
});

test('authenticate rejects Bearer token with invalid payload (missing role)', () => {
    const token = jwt.sign({ id: 1, username: 'admin' }, config.auth.jwtSecret);
    const req = { cookies: {}, headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
});

test('authenticate rejects malformed Authorization header', () => {
    const req = { cookies: {}, headers: { authorization: 'Basic dXNlcjpwYXNz' } };
    const res = createRes();
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
});

test('authenticate trims whitespace from Bearer token', () => {
    const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, config.auth.jwtSecret);
    const req = { cookies: {}, headers: { authorization: `Bearer  ${token}  ` } };
    const res = createRes();
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user.id, 1);
    assert.equal(res.statusCode, null);
});

test('authenticate rejects expired cookie token with 401', () => {
    const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, config.auth.jwtSecret, { expiresIn: '0s' });
    const req = { cookies: { [config.auth.cookie.name]: token }, headers: {} };
    const res = createRes();
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
});

test('authenticate rejects invalid cookie token with 401', () => {
    const req = { cookies: { [config.auth.cookie.name]: 'invalid.token.here' }, headers: {} };
    const res = createRes();
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
});