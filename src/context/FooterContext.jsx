import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFooterSettings } from '../services/footerSettingsService';
import { DEFAULT_FOOTER_SETTINGS } from '../features/footer-settings/constants/defaultFooterSettings';

const FooterContext = createContext();

export const useFooter = () => useContext(FooterContext);

export const FooterProvider = ({ children }) => {
    const [footerSettings, setFooterSettings] = useState(DEFAULT_FOOTER_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadFooterSettings = async () => {
            try {
                const settings = await getFooterSettings();
                setFooterSettings(settings);
            } catch (err) {
                console.error('Failed to load footer settings:', err);
                setError(err);
                // Keep default settings on error
            } finally {
                setLoading(false);
            }
        };

        loadFooterSettings();
    }, []);

    return (
        <FooterContext.Provider value={{ footerSettings, loading, error }}>
            {children}
        </FooterContext.Provider>
    );
};
