import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

const Login = () => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login, user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    // Redirect if already authenticated
    React.useEffect(() => {
        if (!authLoading && user) {
            navigate('/admin');
        }
    }, [user, authLoading, navigate]);

    if (authLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#FCFBF9', color: '#1A1817', fontFamily: 'Inter, sans-serif' }}>
                Checking authentication...
            </div>
        );
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!identifier || !password) {
            setError('Please enter both username/email and password.');
            return;
        }

        setLoading(true);

        const result = await login(identifier, password);

        if (result.success) {
            navigate('/admin');
        } else {
            setError(result.message);
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-header">
                    <span className="login-logo">MS FRAGRANCE</span>
                    <h1 className="login-title">ADMINISTRATION PORTAL</h1>
                    <p className="login-subtitle">Welcome back. Sign in to continue.</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    {error && <div className="login-error">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="identifier" className="form-label">Username or Email</label>
                        <div className="input-wrapper">
                            <input
                                id="identifier"
                                type="text"
                                className="form-input"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                disabled={loading}
                                autoComplete="username"
                            />
                        </div>
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

                    <button
                        type="submit"
                        className="btn login-button"
                        disabled={loading}
                    >
                        {loading ? 'SIGNING IN...' : 'SIGN IN'}
                    </button>
                </form>

                <Link to="/" className="back-link">
                    &larr; Back to Store
                </Link>
            </div>
        </div>
    );
};

export default Login;
