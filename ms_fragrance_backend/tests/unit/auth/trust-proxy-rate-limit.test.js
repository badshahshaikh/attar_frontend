import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import rateLimit from 'express-rate-limit';
import app from '../../../src/app.js';

test('app has trust proxy configured to 1 for reverse proxy environments', () => {
    assert.equal(
        app.get('trust proxy'),
        1,
        'app.get("trust proxy") must equal 1 so Express trusts the first hop reverse proxy (Vercel/Render)'
    );
});

test('reproducer / fail-before: without trust proxy, reverse proxy clients share socket IP and suffer DoS collision', async () => {
    // Model the bug prior to MSF-AUTH-04 fix
    const vulnerableApp = express();
    // Intentionally omitted: vulnerableApp.set('trust proxy', 1);
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 2,
        message: { success: false, message: 'Too many attempts' },
    });
    vulnerableApp.post('/api/auth/test-limit', limiter, (req, res) => {
        res.json({ success: true, ip: req.ip });
    });

    const server = vulnerableApp.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
        const clientA = '203.0.113.100';
        const clientB = '198.51.100.200';

        // Client A sends 2 requests, exhausting the limit
        const resA1 = await fetch(`${baseUrl}/api/auth/test-limit`, {
            method: 'POST',
            headers: { 'X-Forwarded-For': clientA },
        });
        assert.equal(resA1.status, 200);

        const resA2 = await fetch(`${baseUrl}/api/auth/test-limit`, {
            method: 'POST',
            headers: { 'X-Forwarded-For': clientA },
        });
        assert.equal(resA2.status, 200);

        // Client A is now throttled
        const resA3 = await fetch(`${baseUrl}/api/auth/test-limit`, {
            method: 'POST',
            headers: { 'X-Forwarded-For': clientA },
        });
        assert.equal(resA3.status, 429);

        // Demonstrating Bug: Client B on completely different IP is blocked with 429 because req.ip resolves to socket IP
        const resB = await fetch(`${baseUrl}/api/auth/test-limit`, {
            method: 'POST',
            headers: { 'X-Forwarded-For': clientB },
        });
        assert.equal(
            resB.status,
            429,
            'Without trust proxy, Client B collides on the shared socket IP and gets throttled (DoS)'
        );
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test('pass-after: with trust proxy set to 1, req.ip resolves X-Forwarded-For and isolates rate limits', async () => {
    const fixedApp = express();
    fixedApp.set('trust proxy', 1);
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 2,
        message: { success: false, message: 'Too many attempts' },
    });
    fixedApp.post('/api/auth/test-limit', limiter, (req, res) => {
        res.json({ success: true, ip: req.ip });
    });

    const server = fixedApp.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
        const clientA = '203.0.113.100';
        const clientB = '198.51.100.200';

        // Client A exhausts rate limit
        const resA1 = await fetch(`${baseUrl}/api/auth/test-limit`, {
            method: 'POST',
            headers: { 'X-Forwarded-For': clientA },
        });
        const bodyA1 = await resA1.json();
        assert.equal(resA1.status, 200);
        assert.equal(bodyA1.ip, clientA, 'req.ip reflects client A IP from X-Forwarded-For');

        await fetch(`${baseUrl}/api/auth/test-limit`, {
            method: 'POST',
            headers: { 'X-Forwarded-For': clientA },
        });

        // Client A gets 429
        const resA3 = await fetch(`${baseUrl}/api/auth/test-limit`, {
            method: 'POST',
            headers: { 'X-Forwarded-For': clientA },
        });
        assert.equal(resA3.status, 429, 'Client A is rate-limited');

        // Client B is NOT throttled
        const resB = await fetch(`${baseUrl}/api/auth/test-limit`, {
            method: 'POST',
            headers: { 'X-Forwarded-For': clientB },
        });
        assert.equal(resB.status, 200, 'Client B receives 200, isolated from Client A throttling');
        const bodyB = await resB.json();
        assert.equal(bodyB.ip, clientB, 'req.ip reflects client B IP from X-Forwarded-For');
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test('production app: rate limiting on /api/auth/login isolates distinct client IPs under X-Forwarded-For', async () => {
    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const clientA = '203.0.113.10';
    const clientB = '203.0.113.20';

    try {
        // Send 10 failed login requests from Client A to exhaust loginLimiter (max 10)
        for (let i = 0; i < 10; i++) {
            const res = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Forwarded-For': clientA,
                },
                body: JSON.stringify({}),
            });
            assert.equal(res.status, 400, `Attempt ${i + 1} from Client A should reach controller and return 400`);
        }

        // 11th request from Client A must be rate-limited (HTTP 429)
        const lockedResponseA = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Forwarded-For': clientA,
            },
            body: JSON.stringify({}),
        });
        assert.equal(lockedResponseA.status, 429, 'Client A must be throttled with HTTP 429');
        const lockedBodyA = await lockedResponseA.json();
        assert.equal(lockedBodyA.success, false);
        assert.match(lockedBodyA.message, /Too many login attempts/);

        // Client B from a different IP must NOT be rate-limited
        const responseB = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Forwarded-For': clientB,
            },
            body: JSON.stringify({}),
        });
        assert.notEqual(
            responseB.status,
            429,
            'Client B on a different IP must not be throttled by Client A rate-limiting'
        );
        assert.equal(responseB.status, 400, 'Client B should reach controller and return 400');
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});
