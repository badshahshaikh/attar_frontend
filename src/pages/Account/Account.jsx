import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import AddressBook from './AddressBook';
import OrderHistory from './OrderHistory';
import './Account.css';

const TABS = [
    { id: 'profile', label: 'Profile' },
    { id: 'addresses', label: 'Addresses' },
    { id: 'orders', label: 'Orders' },
    { id: 'security', label: 'Security' },
];

const Account = () => {
    const { user, updateProfile, changePassword, logout } = useCustomerAuth();
    const navigate = useNavigate();

    const [tab, setTab] = useState('profile');

    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [profileStatus, setProfileStatus] = useState({ error: '', success: '' });
    const [profileSaving, setProfileSaving] = useState(false);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [passwordStatus, setPasswordStatus] = useState({ error: '' });
    const [passwordSaving, setPasswordSaving] = useState(false);

    useEffect(() => {
        if (user) {
            setFullName(user.fullName || '');
            setPhone(user.phone || '');
        }
    }, [user]);

    const handleProfileSave = async (e) => {
        e.preventDefault();
        setProfileStatus({ error: '', success: '' });
        setProfileSaving(true);

        try {
            await updateProfile({ fullName: fullName.trim(), phone: phone.trim() });
            setProfileStatus({ error: '', success: 'Your details have been saved.' });
        } catch (error) {
            setProfileStatus({ error: error.message, success: '' });
        } finally {
            setProfileSaving(false);
        }
    };

    const handlePasswordSave = async (e) => {
        e.preventDefault();
        setPasswordStatus({ error: '' });
        setPasswordSaving(true);

        try {
            await changePassword(currentPassword, newPassword);
            // The server clears the session cookie after a password change.
            navigate('/login', { replace: true });
        } catch (error) {
            setPasswordStatus({ error: error.message });
            setPasswordSaving(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/', { replace: true });
    };

    return (
        <main className="account-page">
            <div className="container">
                <header className="account-header">
                    <p className="account-eyebrow">My account</p>
                    <h1 className="account-title">{user?.fullName || 'Your account'}</h1>
                    <p className="account-subtitle">{user?.email}</p>
                </header>

                <nav className="account-tabs" aria-label="Account sections">
                    {TABS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={`account-tab${tab === item.id ? ' is-active' : ''}`}
                            onClick={() => setTab(item.id)}
                            aria-current={tab === item.id ? 'page' : undefined}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="account-panel">
                    {tab === 'profile' && (
                    <section className="account-card">
                        <h2>Your details</h2>
                        <form className="auth-form" onSubmit={handleProfileSave}>
                            {profileStatus.error && <div className="auth-error">{profileStatus.error}</div>}
                            {profileStatus.success && <div className="auth-success">{profileStatus.success}</div>}

                            <div className="form-group">
                                <label htmlFor="accountEmail" className="form-label">Email</label>
                                <input id="accountEmail" type="email" className="form-input" value={user?.email || ''} disabled />
                            </div>

                            <div className="form-group">
                                <label htmlFor="accountFullName" className="form-label">Full name</label>
                                <input
                                    id="accountFullName"
                                    type="text"
                                    className="form-input"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    disabled={profileSaving}
                                    autoComplete="name"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="accountPhone" className="form-label">Phone number</label>
                                <input
                                    id="accountPhone"
                                    type="tel"
                                    className="form-input"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    disabled={profileSaving}
                                    autoComplete="tel"
                                    required
                                />
                            </div>

                            <button type="submit" className="btn auth-button" disabled={profileSaving}>
                                {profileSaving ? 'SAVING...' : 'SAVE DETAILS'}
                            </button>
                        </form>
                    </section>
                    )}

                    {tab === 'security' && (
                    <section className="account-card">
                        <h2>Change password</h2>
                        <form className="auth-form" onSubmit={handlePasswordSave}>
                            {passwordStatus.error && <div className="auth-error">{passwordStatus.error}</div>}

                            <div className="form-group">
                                <label htmlFor="currentPassword" className="form-label">Current password</label>
                                <input
                                    id="currentPassword"
                                    type="password"
                                    className="form-input"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    disabled={passwordSaving}
                                    autoComplete="current-password"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="newPassword" className="form-label">New password</label>
                                <input
                                    id="newPassword"
                                    type="password"
                                    className="form-input"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    disabled={passwordSaving}
                                    autoComplete="new-password"
                                    minLength="8"
                                    required
                                />
                            </div>

                            <button type="submit" className="btn auth-button" disabled={passwordSaving}>
                                {passwordSaving ? 'UPDATING...' : 'UPDATE PASSWORD'}
                            </button>
                        </form>

                        <p className="account-hint">Updating your password signs you out on every device.</p>
                        <button type="button" className="btn btn-outline w-100" onClick={handleLogout}>
                            SIGN OUT
                        </button>
                    </section>
                    )}

                    {tab === 'addresses' && <AddressBook />}
                    {tab === 'orders' && <OrderHistory />}
                </div>
            </div>
        </main>
    );
};

export default Account;