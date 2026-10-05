import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

import {
    registerCustomer,
    loginCustomer,
    fetchCustomer,
    logoutCustomer,
    updateCustomerProfile,
    changeCustomerPassword,
} from '../services/customerService';

const CustomerAuthContext = createContext();

export const useCustomerAuth = () => useContext(CustomerAuthContext);

/**
 * CustomerAuthProvider — storefront account state.
 *
 * Deliberately separate from AuthContext (admin): the two sessions live in
 * different cookies, so signing in as a customer never disturbs an admin
 * session and vice versa.
 */
export const CustomerAuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            setUser(await fetchCustomer());
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const register = async (payload) => {
        setUser(await registerCustomer(payload));
    };

    const login = async (email, password) => {
        setUser(await loginCustomer(email, password));
    };

    const logout = async () => {
        try {
            await logoutCustomer();
        } finally {
            setUser(null);
        }
    };

    const updateProfile = async (payload) => {
        const updated = await updateCustomerProfile(payload);
        setUser(updated);
        return updated;
    };

    const changePassword = async (currentPassword, newPassword) => {
        await changeCustomerPassword(currentPassword, newPassword);
        // The server clears the session cookie after a password change.
        setUser(null);
    };

    return (
        <CustomerAuthContext.Provider
            value={{ user, loading, register, login, logout, updateProfile, changePassword }}
        >
            {children}
        </CustomerAuthContext.Provider>
    );
};