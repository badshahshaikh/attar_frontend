import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './admin.css';

const MOBILE_BREAKPOINT = 700;

export default function AdminLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [drawerOpen, setDrawerOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/admin/login');
    };

    const closeDrawer = useCallback(() => setDrawerOpen(false), []);
    const toggleDrawer = useCallback(() => setDrawerOpen((prev) => !prev), []);

    // Close the drawer when resizing back to desktop so the sidebar is never
    // stuck open on large viewports.
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > MOBILE_BREAKPOINT) setDrawerOpen(false);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Lock background scrolling while the mobile drawer is open.
    useEffect(() => {
        if (!drawerOpen) return;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, [drawerOpen]);

    const navLinks = (
        <>
            <NavLink to="/admin" end onClick={closeDrawer}>Dashboard</NavLink>
            <NavLink to="/admin/products" end onClick={closeDrawer}>Products</NavLink>
            <NavLink to="/admin/products/bulk" end onClick={closeDrawer}>Bulk Manage</NavLink>
            <NavLink to="/admin/brands" onClick={closeDrawer}>
                Brands
            </NavLink>

            <NavLink to="/admin/categories" onClick={closeDrawer}>
                Categories
            </NavLink>
            <NavLink to="/admin/customers" onClick={closeDrawer}>
                Customers
            </NavLink>
            <NavLink to="/admin/orders" onClick={closeDrawer}>
                Orders
            </NavLink>
            <NavLink to="/admin/returns" onClick={closeDrawer}>
                Returns
            </NavLink>
            <NavLink to="/admin/footer-settings" onClick={closeDrawer}>Footer Settings</NavLink>
        </>
    );

    return (
        <div className="admin-shell">
            <main className="admin-main">
                <div className="admin-mobile-bar">
                    <button
                        type="button"
                        className="admin-menu-toggle"
                        onClick={toggleDrawer}
                        aria-label={drawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
                        aria-expanded={drawerOpen}
                    >
                        {drawerOpen ? (
                            <X size={20} strokeWidth={2} />
                        ) : (
                            <Menu size={20} strokeWidth={2} />
                        )}
                    </button>
                    <Link to="/admin" className="admin-brand">
                        MS FRAGRANCE <span>ADMIN</span>
                    </Link>
                    <button type="button" className="admin-logout" onClick={handleLogout}>
                        Log out
                    </button>
                </div>
                <div className="admin-user">Signed in as <strong>{user?.username}</strong></div>
                <Outlet />
            </main>

            {drawerOpen && (
                <div className="admin-drawer-backdrop" onClick={closeDrawer} aria-hidden="true" />
            )}

            <aside
                className={`admin-sidebar${drawerOpen ? ' admin-sidebar--open' : ''}`}
            >
                <Link to="/admin" className="admin-brand">
                    MS FRAGRANCE <span>ADMIN</span>
                </Link>
                <nav className="admin-nav" aria-label="Admin navigation">
                    {navLinks}
                </nav>
                <button type="button" className="admin-logout" onClick={handleLogout}>
                    Log out
                </button>
                {drawerOpen && (
                    <button
                        type="button"
                        className="admin-drawer-close"
                        onClick={closeDrawer}
                        aria-label="Close navigation menu"
                    >
                        <X size={20} strokeWidth={2} />
                    </button>
                )}
            </aside>
        </div>
    );
}
