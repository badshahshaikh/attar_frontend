import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import './Account.css';

const Register = () => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { register } = useCustomerAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);

        try {
            await register({
                fullName: fullName.trim(),
                email: email.trim(),
                phone: phone.trim(),
                password,
            });
            navigate('/account', { replace: true });
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
                    <h1 className="auth-title">Create account</h1>
                    <p className="auth-subtitle">Save your addresses and keep track of your orders.</p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <div className="auth-error">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="fullName" className="form-label">Full name</label>
                        <input
                            id="fullName"
                            type="text"
                            className="form-input"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            disabled={loading}
                            autoComplete="name"
                            required
                        />
                    </div>

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
                        <label htmlFor="phone" className="form-label">Phone number</label>
                        <input
                            id="phone"
                            type="tel"
                            className="form-input"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            disabled={loading}
                            autoComplete="tel"
                            placeholder="10-digit mobile number"
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
                                autoComplete="new-password"
                                minLength="8"
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

                    <div className="form-group">
                        <label htmlFor="confirmPassword" className="form-label">Confirm password</label>
                        <input
                            id="confirmPassword"
                            type={showPassword ? 'text' : 'password'}
                            className="form-input"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={loading}
                            autoComplete="new-password"
                            minLength="8"
                            required
                        />
                    </div>

                    <button type="submit" className="btn auth-button" disabled={loading}>
                        {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
                    </button>
                </form>

                <Link to="/login" className="auth-switch">
                    Already have an account? Sign in
                </Link>

                <Link to="/" className="back-link">&larr; Back to Store</Link>
            </div>
        </div>
    );
};

export default Register;