import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#FCFBF9', color: '#1A1817', fontFamily: 'Inter, sans-serif' }}>
                Checking authentication...
            </div>
        );
    }

    // The admin area is restricted to the 'admin' role. An authenticated
    // customer must not be able to render admin screens.
    if (!user || user.role !== 'admin') {
        return <Navigate to="/admin/login" replace />;
    }

    return children ? children : <Outlet />;
};

export default ProtectedRoute;
