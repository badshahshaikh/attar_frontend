const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { config } = require('../../config/env');

function createAuthService({ userRepository }) {
    return {
        async login({ username, password }) {
            const user = await userRepository.findByUsernameOrEmail(username);
            if (!user || !(await bcrypt.compare(password, user.password_hash))) return null;
            const payload = { id: user.id, username: user.username, role: user.role };
            const token = jwt.sign(payload, config.auth.jwtSecret, { expiresIn: config.auth.jwtExpiresIn });
            return { payload, token };
        },
    };
}

module.exports = { createAuthService };
