import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { cartReducer, initialState, hydrateCart } from './cartReducer';

const CartContext = createContext();

// Rebuild cart state from localStorage through the pure hydrateCart() helper
// so hydration (including stale-stock clamping) is testable from Node.
const init = (fallbackState) => hydrateCart(
    typeof localStorage === 'undefined' ? null : localStorage.getItem('attar_cart'),
    fallbackState
);

export const CartProvider = ({ children }) => {
    const [state, dispatch] = useReducer(cartReducer, initialState, init);

    useEffect(() => {
        localStorage.setItem('attar_cart', JSON.stringify(state));
    }, [state]);

    const cartCount = state.items.reduce((count, item) => count + item.quantity, 0);
    const cartSubtotal = state.items.reduce((total, item) => total + item.total, 0);

    return (
        <CartContext.Provider value={{ state, dispatch, cartCount, cartSubtotal }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    return useContext(CartContext);
};
