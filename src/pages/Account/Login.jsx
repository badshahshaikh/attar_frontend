import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import './Account.css';

/**
 * Customer sign in. The admin portal keeps its own page at /admin/login —
 * these are separate sessions backed by separate cookies.
 */
const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login, user, loading: authLoading } = useCustomerAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from || '/account';

    React.useEffect(() => {
        if (!authLoading && user) {
            navigate(from, { replace: true });
        }
    }, [user, authLoading, navigate, from]);

    if (authLoading) {
        return (
            <div className="auth-page">
                <div className="auth-container">
                    <p className="auth-subtitle">Checking your account...</p>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Please enter your email and password.');
            return;
        }

        setLoading(true);

        try {
            await login(email.trim(), password);
            navigate(from, { replace: true });
        } catch (submitError) {
            setError(submitError.message);
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-header">
                    <span className="auth-logo">MS FRAGRANCE</span>
                    <h1 className="auth-title">Sign in</h1>
                    <p className="auth-subtitle">Welcome back. Sign in to see your orders and saved addresses.</p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <div className="auth-error">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="email" className="form-label">Email</label>
                        <input
                            id="email"
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            autoComplete="email"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password" className="form-label">Password</label>
                        <div className="input-wrapper">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                autoComplete="current-password"
                                required
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex="-1"
                            >
                                {showPassword ? 'HIDE' : 'SHOW'}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="btn auth-button" disabled={loading}>
                        {loading ? 'SIGNING IN...' : 'SIGN IN'}
                    </button>
                </form>

                <Link to="/register" className="auth-switch">
                    New to MS Fragrance? Create an account
                </Link>

                <Link to="/" className="back-link">&larr; Back to Store</Link>
            </div>
        </div>
    );
};

export default Login;