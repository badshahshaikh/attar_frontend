import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';
import AppError from '../../core/errors/AppError.js';

const BCRYPT_ROUNDS = 12;

// Explicit field allow-list so password_hash can never reach a response.
function toPublicUser(row) {
    return {
        id: Number(row.id),
        email: row.email,
        fullName: row.full_name || '',
        phone: row.phone || '',
        role: row.role,
        createdAt: row.created_at,
    };
}

function createAuthService({ userRepository }) {
    function signCustomerToken(customer) {
        // Kept minimal on purpose: profile data is read fresh from the database
        // so a stale name in the token can never be trusted.
        return jwt.sign(
            { id: Number(customer.id), email: customer.email, role: 'customer' },
            config.auth.jwtSecret,
            { expiresIn: config.auth.customerJwtExpiresIn }
        );
    }

    return {
        async login({ username, password }) {
            const user = await userRepository.findByUsernameOrEmail(username);
            if (!user || !(await bcrypt.compare(password, user.password_hash))) return null;
            // The admin portal is for admins only. Customers sign in through the
            // storefront endpoints so the two sessions never collide.
            if (user.role !== 'admin') return null;
            const payload = { id: user.id, username: user.username, role: user.role };
            const token = jwt.sign(payload, config.auth.jwtSecret, { expiresIn: config.auth.jwtExpiresIn });
            return { payload, token };
        },

        async register({ fullName, email, phone, password }) {
            const existing = await userRepository.findByEmail(email);

            if (existing) {
                throw new AppError('An account with this email already exists', 409, 'EMAIL_TAKEN');
            }

            const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
            const customer = await userRepository.createCustomer({
                fullName,
                email,
                passwordHash,
                phone,
            });

            return { user: toPublicUser(customer), token: signCustomerToken(customer) };
        },

        async customerLogin({ email, password }) {
            const user = await userRepository.findByEmail(email);

            // One generic failure for both an unknown email and a bad password,
            // so this endpoint cannot be used to discover who has an account.
            if (!user || user.role !== 'customer') return null;
            if (!(await bcrypt.compare(password, user.password_hash))) return null;

            await userRepository.touchLastLogin(user.id);

            return { user: toPublicUser(user), token: signCustomerToken(user) };
        },

        async getProfile(customerId) {
            const customer = await userRepository.findCustomerById(customerId);

            if (!customer) {
                throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND');
            }

            return toPublicUser(customer);
        },

        async updateProfile(customerId, { fullName, phone }) {
            const customer = await userRepository.updateCustomerProfile(customerId, { fullName, phone });

            if (!customer) {
                throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND');
            }

            return toPublicUser(customer);
        },

        async changePassword(customerId, { currentPassword, newPassword }) {
            const credentials = await userRepository.findCustomerCredentialsById(customerId);

            if (!credentials) {
                throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND');
            }

            if (!(await bcrypt.compare(currentPassword, credentials.password_hash))) {
                throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');
            }

            const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
            await userRepository.updatePasswordHash(customerId, passwordHash);
        },
    };
}


export { createAuthService };
