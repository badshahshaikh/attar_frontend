import React, { createContext, useContext, useState, useEffect } from 'react';

const WishlistContext = createContext();

export const WishlistProvider = ({ children }) => {
    const [wishlistItems, setWishlistItems] = useState(() => {
        try {
            const saved = localStorage.getItem('attar_wishlist');
            if (!saved) return [];

            const parsed = JSON.parse(saved);
            if (!Array.isArray(parsed)) return [];

            const cleanedWishlist = parsed
                .map(item => typeof item === 'number' && Number.isInteger(item) && item > 0 ? item : null)
                .filter(Boolean);

            return [...new Set(cleanedWishlist)];
        } catch (error) {
            console.error('Failed to parse wishlist from local storage', error);
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem('attar_wishlist', JSON.stringify(wishlistItems));
    }, [wishlistItems]);

    const addToWishlist = (productId) => {
        setWishlistItems(prev => {
            if (prev.includes(productId)) return prev;
            return [...prev, productId];
        });
    };

    const removeFromWishlist = (productId) => {
        setWishlistItems(prev => prev.filter(id => id !== productId));
    };

    const toggleWishlist = (productId) => {
        setWishlistItems(prev => {
            if (prev.includes(productId)) {
                return prev.filter(id => id !== productId);
            }
            return [...prev, productId];
        });
    };

    const isInWishlist = (productId) => {
        return wishlistItems.includes(productId);
    };

    return (
        <WishlistContext.Provider value={{ wishlistItems, addToWishlist, removeFromWishlist, toggleWishlist, isInWishlist }}>
            {children}
        </WishlistContext.Provider>
    );
};

export const useWishlist = () => {
    return useContext(WishlistContext);
};
