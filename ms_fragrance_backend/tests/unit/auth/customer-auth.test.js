import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { createAuthService } from '../../../src/modules/auth/auth.service.js';
import { authenticateCustomer } from '../../../src/shared/middleware/authenticate.js';
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

test('authenticateCustomer rejects a missing, malformed or non-customer cookie', () => {
    let res = createRes();
    authenticateCustomer({ cookies: {} }, res, () => {});
    assert.equal(res.statusCode, 401);

    res = createRes();
    const adminToken = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, config.auth.jwtSecret);
    authenticateCustomer({ cookies: { [config.auth.customerCookie.name]: adminToken } }, res, () => {});
    assert.equal(res.statusCode, 401, 'an admin token must not authenticate a customer route');
});

test('authenticateCustomer attaches the customer and continues', () => {
    const token = jwt.sign({ id: 42, email: 'a@example.com', role: 'customer' }, config.auth.jwtSecret);
    const req = { cookies: { [config.auth.customerCookie.name]: token } };
    const res = createRes();
    let nextCalled = false;

    authenticateCustomer(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.customer.id, 42);
    assert.equal(res.statusCode, null);
});

test('register refuses an email that is already taken', async () => {
    const service = createAuthService({
        userRepository: {
            findByEmail: async () => ({ id: 1, email: 'aisha@example.com' }),
            createCustomer: async () => assert.fail('must not create a duplicate'),
        },
    });

    await assert.rejects(
        () => service.register({
            fullName: 'Aisha Khan',
            email: 'aisha@example.com',
            phone: '9876543210',
            password: 'attar1234',
        }),
        error => error.statusCode === 409
    );
});

test('register stores a bcrypt hash and never returns it', async () => {
    let inserted;
    const service = createAuthService({
        userRepository: {
            findByEmail: async () => null,
            createCustomer: async payload => {
                inserted = payload;
                return {
                    id: 7,
                    email: payload.email,
                    full_name: payload.fullName,
                    phone: payload.phone,
                    role: 'customer',
                    created_at: '2026-01-01T00:00:00Z',
                };
            },
        },
    });

    const result = await service.register({
        fullName: 'Aisha Khan',
        email: 'aisha@example.com',
        phone: '9876543210',
        password: 'attar1234',
    });

    assert.notEqual(inserted.passwordHash, 'attar1234');
    assert.equal(await bcrypt.compare('attar1234', inserted.passwordHash), true);
    assert.equal(result.user.id, 7);
    assert.equal(result.user.role, 'customer');
    assert.equal(result.user.passwordHash, undefined, 'password material must not be returned');
    assert.equal(result.token.split('.').length, 3);
});

test('the admin portal refuses a customer account and vice versa', async () => {
    const passwordHash = await bcrypt.hash('attar1234', 10);
    const customer = { id: 7, email: 'a@example.com', password_hash: passwordHash, role: 'customer' };
    const admin = { id: 1, username: 'admin', email: 'admin@example.com', password_hash: passwordHash, role: 'admin' };

    const service = createAuthService({
        userRepository: {
            findByEmail: async email => (email === 'a@example.com' ? customer : admin),
            findByUsernameOrEmail: async () => customer,
            touchLastLogin: async () => {},
        },
    });

    assert.equal(
        await service.customerLogin({ email: 'nobody@example.com', password: 'attar1234' }),
        null,
        'unknown email must not authenticate'
    );
    assert.equal(
        await service.customerLogin({ email: 'a@example.com', password: 'wrongpass1' }),
        null,
        'wrong password must not authenticate'
    );
    assert.equal(
        await service.customerLogin({ email: 'admin@example.com', password: 'attar1234' }),
        null,
        'an admin account must not authenticate as a customer'
    );
    assert.equal(
        await service.login({ username: 'aisha', password: 'attar1234' }),
        null,
        'a customer account must not authenticate on the admin portal'
    );
});

test('changePassword requires the correct current password', async () => {
    const passwordHash = await bcrypt.hash('attar1234', 10);
    let updated = null;
    const service = createAuthService({
        userRepository: {
            findCustomerCredentialsById: async () => ({ id: 7, email: 'a@example.com', password_hash: passwordHash }),
            updatePasswordHash: async (id, hash) => {
                updated = { id, hash };
                return { id };
            },
        },
    });

    await assert.rejects(
        () => service.changePassword(7, { currentPassword: 'nope1234', newPassword: 'newpass123' }),
        error => error.statusCode === 400
    );
    assert.equal(updated, null, 'a failed attempt must not overwrite the stored hash');

    await service.changePassword(7, { currentPassword: 'attar1234', newPassword: 'newpass123' });
    assert.equal(await bcrypt.compare('newpass123', updated.hash), true);
});