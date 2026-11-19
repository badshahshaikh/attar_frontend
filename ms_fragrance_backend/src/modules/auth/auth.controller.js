
import {
    validateLogin,
    validateCustomerRegister,
    validateCustomerLogin,
    validateProfileUpdate,
    validatePasswordChange,
} from './auth.validator.js';
import {
    setAuthCookie,
    clearAuthCookie,
    setCustomerCookie,
    clearCustomerCookie,
} from './auth.cookie.js';
import { logger } from '../../shared/logging/logger.js';

function createAuthController({ authService }) {
    return {
        async login(req, res) {
            let credentials;

            try {
                credentials = validateLogin(req.body);
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }

            try {
                const result = await authService.login(credentials);

                if (!result) {
                    return res.status(401).json({
                        success: false,
                        message: 'Invalid username/email or password',
                    });
                }

                setAuthCookie(res, result.token);

                return res.json({
                    success: true,
                    user: result.payload,
                });
            } catch (error) {
                logger.error('Login error:', {
                    errorMessage: error.message,
                });

                return res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                });
            }
        },

        logout(req, res) {
            clearAuthCookie(res);

            res.json({
                success: true,
                message: 'Logged out successfully',
            });
        },

        me(req, res) {
            res.json({
                authenticated: true,
                user: req.user,
            });
        },

        // ── Customer storefront endpoints ──────────────────────────────────

        async customerRegister(req, res) {
            let payload;

            try {
                payload = validateCustomerRegister(req.body);
            } catch (error) {
                return res.status(400).json({ success: false, message: error.message });
            }

            try {
                const result = await authService.register(payload);
                setCustomerCookie(res, result.token);

                return res.status(201).json({ success: true, user: result.user, token: result.token });
            } catch (error) {
                if (error.statusCode === 409) {
                    return res.status(409).json({ success: false, message: error.message });
                }

                logger.error('Customer registration error:', { errorMessage: error.message });

                return res.status(500).json({
                    success: false,
                    message: 'We could not create your account. Please try again.',
                });
            }
        },

        async customerLogin(req, res) {
            let credentials;

            try {
                credentials = validateCustomerLogin(req.body);
            } catch (error) {
                return res.status(400).json({ success: false, message: error.message });
            }

            try {
                const result = await authService.customerLogin(credentials);

                if (!result) {
                    return res.status(401).json({
                        success: false,
                        message: 'We could not sign you in with those details.',
                    });
                }

                setCustomerCookie(res, result.token);

                return res.json({ success: true, user: result.user, token: result.token });
            } catch (error) {
                logger.error('Customer login error:', { errorMessage: error.message });

                return res.status(500).json({
                    success: false,
                    message: 'We could not sign you in right now. Please try again.',
                });
            }
        },

        customerLogout(req, res) {
            clearCustomerCookie(res);
            res.json({ success: true, message: 'Signed out successfully' });
        },

        async customerMe(req, res) {
            try {
                const user = await authService.getProfile(req.customer.id);
                return res.json({ authenticated: true, user });
            } catch (error) {
                if (error.statusCode === 404) {
                    return res.status(401).json({
                        success: false,
                        message: 'Your session is no longer valid',
                    });
                }

                logger.error('Customer profile error:', { errorMessage: error.message });

                return res.status(500).json({
                    success: false,
                    message: 'Unable to load your profile',
                });
            }
        },

        async updateCustomerProfile(req, res) {
            let payload;

            try {
                payload = validateProfileUpdate(req.body);
            } catch (error) {
                return res.status(400).json({ success: false, message: error.message });
            }

            try {
                const user = await authService.updateProfile(req.customer.id, payload);
                return res.json({ success: true, user });
            } catch (error) {
                if (error.statusCode === 404) {
                    return res.status(401).json({
                        success: false,
                        message: 'Your session is no longer valid',
                    });
                }

                logger.error('Customer profile update error:', { errorMessage: error.message });

                return res.status(500).json({
                    success: false,
                    message: 'Unable to update your profile',
                });
            }
        },

        async changeCustomerPassword(req, res) {
            let payload;

            try {
                payload = validatePasswordChange(req.body);
            } catch (error) {
                return res.status(400).json({ success: false, message: error.message });
            }

            try {
                await authService.changePassword(req.customer.id, payload);
                clearCustomerCookie(res);
                return res.json({ success: true, message: 'Password updated. Please sign in again.' });
            } catch (error) {
                if (error.statusCode === 400 || error.statusCode === 404) {
                    return res.status(error.statusCode).json({ success: false, message: error.message });
                }

                logger.error('Customer password change error:', { errorMessage: error.message });

                return res.status(500).json({
                    success: false,
                    message: 'Unable to change your password',
                });
            }
        },
    };
}

export { createAuthController };