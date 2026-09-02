import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import './Admin.css';

const Admin = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/admin/login');
    };

    return (
        <div className="container admin-page">
            <div className="admin-header">
                <div>
                    <h1 className="admin-title">MS FRAGRANCE</h1>
                    <h2 className="admin-title" style={{ fontSize: '1.5rem', color: 'var(--color-text-secondary)' }}>Admin Dashboard</h2>
                    <p className="admin-welcome">Welcome, {user?.username}</p>
                </div>
                <div className="admin-actions">
                    <button onClick={handleLogout} className="btn btn-outline">LOGOUT</button>
                </div>
            </div>

            <div className="admin-content">
                <h3>Product Management APIs configured and protected.</h3>
                <p>The backend APIs now require this administrative session to perform modifications.</p>
                <div style={{ marginTop: '2rem' }}>
                    <Link to="/" className="btn btn-primary">Go to Storefront</Link>
                </div>
            </div>
        </div>
    );
};

export default Admin;
