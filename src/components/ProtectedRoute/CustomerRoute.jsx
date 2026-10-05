import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useCustomerAuth } from '../../context/CustomerAuthContext';

/**
 * CustomerRoute — guards storefront account pages.
 *
 * Sends guests to /login and remembers where they were headed so they land
 * back there after signing in.
 */
const CustomerRoute = ({ children }) => {
    const { user, loading } = useCustomerAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#FCFBF9', color: '#1A1817', fontFamily: 'Inter, sans-serif' }}>
                Checking authentication...
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return children ? children : <Outlet />;
};

export default CustomerRoute;