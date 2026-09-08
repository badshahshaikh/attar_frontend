import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFooterSettings } from '../services/footerSettingsService';

const FooterContext = createContext();

export const useFooter = () => useContext(FooterContext);

const defaultFooterSettings = {
    brand: {
        name: 'MS Fragrance',
        description: 'The art of pure, non-alcoholic perfumery. We source the finest natural ingredients to craft timeless fragrance experiences for the modern connoisseur.',
        logo: ''
    },
    contact: {
        email: 'hello@rooh-attars.com',
        phone: '+91 98765 43210',
        whatsapp: '+91 98765 43210',
        address: 'Mumbai, India'
    },
    socialMedia: {
        instagram: '',
        facebook: '',
        youtube: '',
        twitter: ''
    },
    links: {
        shop: true,
        about: true,
        collections: true,
        contact: true
    },
    newsletter: {
        enabled: true,
        title: 'Stay Updated',
        description: 'Subscribe to receive updates and exclusive offers.'
    },
    copyright: {
        text: '© 2026 MS Fragrance. All rights reserved.'
    }
};

export const FooterProvider = ({ children }) => {
    const [footerSettings, setFooterSettings] = useState(defaultFooterSettings);
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
