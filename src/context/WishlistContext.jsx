import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockProducts } from '../data/mockProducts';

const WishlistContext = createContext();

export const WishlistProvider = ({ children }) => {
    const [wishlistItems, setWishlistItems] = useState(() => {
        try {
            const saved = localStorage.getItem('attar_wishlist');
            if (!saved) return [];

            const parsed = JSON.parse(saved);
            if (!Array.isArray(parsed)) return [];

            // Generate a fast lookup set of valid product IDs from the current catalog
            const validIds = new Set(mockProducts.map(p => p.id));

            // Filter the saved data to remove duplicates and stale IDs
            const cleanedWishlist = [...new Set(parsed)].filter(id => validIds.has(id));
            return cleanedWishlist;
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
