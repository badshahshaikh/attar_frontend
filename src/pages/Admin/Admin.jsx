import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import '../../components/admin/admin.css';

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
                <h3>Management</h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                    <Link to="/admin/products" className="btn btn-primary">Products</Link>
                    <Link to="/admin/brands" className="btn btn-outline">Brands</Link>
                    <Link to="/admin/categories" className="btn btn-outline">Categories</Link>
                    <Link to="/admin/footer" className="btn btn-outline">Footer Settings</Link>
                </div>
                <div style={{ marginTop: '2rem' }}>
                    <Link to="/" className="btn btn-outline">Go to Storefront</Link>
                </div>
            </div>
        </div>
    );
};

export default Admin;
