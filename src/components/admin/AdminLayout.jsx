import React from 'react';
import { Link, NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './admin.css';

export default function AdminLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/admin/login');
    };

    return (
        <div className="admin-shell">
            <aside className="admin-sidebar">
                <Link to="/admin" className="admin-brand">MS FRAGRANCE <span>ADMIN</span></Link>
                <nav className="admin-nav" aria-label="Admin navigation">
                    <NavLink to="/admin" end>Dashboard</NavLink>
                    <NavLink to="/admin/products" end>Products</NavLink>
                    <NavLink to="/admin/products/bulk">Bulk Manage</NavLink>
                    <NavLink to="/admin/brands">
                        Brands
                    </NavLink>

                    <NavLink to="/admin/categories">
                        Categories
                    </NavLink>
                    <NavLink to="/admin/customers">
                        Customers
                    </NavLink>
                    <NavLink to="/admin/orders">
                        Orders
                    </NavLink>
                    <NavLink to="/admin/footer-settings">Footer Settings</NavLink>
                </nav>
                <button type="button" className="admin-logout" onClick={handleLogout}>Log out</button>
            </aside>
            <main className="admin-main">
                <div className="admin-mobile-bar">
                    <Link to="/admin" className="admin-brand">MS FRAGRANCE <span>ADMIN</span></Link>
                    <button type="button" className="admin-logout" onClick={handleLogout}>Log out</button>
                </div>
                <div className="admin-user">Signed in as <strong>{user?.username}</strong></div>
                <Outlet />
            </main>
        </div>
    );
}
