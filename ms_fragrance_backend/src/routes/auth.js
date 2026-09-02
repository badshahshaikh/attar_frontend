const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many login attempts, please try again later' }
});

router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username/email and password are required' });
        }

        // Use parameterized query
        const userResult = await query(
            'SELECT * FROM users WHERE username = $1 OR email = $1',
            [username]
        );

        const user = userResult.rows[0];

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid username/email or password' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Invalid username/email or password' });
        }

        const payload = {
            id: user.id,
            username: user.username,
            role: user.role
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        });

        const isProduction = process.env.NODE_ENV === 'production';

        res.cookie('jwt', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'None' : 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            success: true,
            user: payload
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

router.post('/logout', (req, res) => {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('jwt', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'None' : 'Lax',
    });
    res.json({ success: true, message: 'Logged out successfully' });
});

router.get('/me', authMiddleware, (req, res) => {
    res.json({
        authenticated: true,
        user: req.user
    });
});

module.exports = router;
