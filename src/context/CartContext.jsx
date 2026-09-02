import React, { createContext, useContext, useReducer, useEffect } from 'react';

const CartContext = createContext();

const initialState = {
    items: [],
};

const cartReducer = (state, action) => {
    switch (action.type) {
        case 'ADD_TO_CART': {
            const newItem = action.payload;
            const existingItemIndex = state.items.findIndex(
                item => item.productId === newItem.productId && item.size === newItem.size
            );

            if (existingItemIndex !== -1) {
                const updatedItems = [...state.items];
                updatedItems[existingItemIndex].quantity += newItem.quantity;
                updatedItems[existingItemIndex].total = updatedItems[existingItemIndex].quantity * updatedItems[existingItemIndex].price;
                return { ...state, items: updatedItems };
            } else {
                return { ...state, items: [...state.items, newItem] };
            }
        }
        case 'REMOVE_FROM_CART': {
            const { productId, size } = action.payload;
            return {
                ...state,
                items: state.items.filter(item => !(item.productId === productId && item.size === size))
            };
        }
        case 'UPDATE_QUANTITY': {
            const { productId, size, quantity } = action.payload;
            if (quantity < 1) return state; // Ensure quantity doesn't go below 1
            const updatedItems = state.items.map(item => {
                if (item.productId === productId && item.size === size) {
                    return { ...item, quantity, total: quantity * item.price };
                }
                return item;
            });
            return { ...state, items: updatedItems };
        }
        case 'CLEAR_CART':
            return { ...state, items: [] };
        default:
            return state;
    }
};

const init = (initialState) => {
    const savedCart = localStorage.getItem('attar_cart');
    if (savedCart) {
        try {
            const parsed = JSON.parse(savedCart);
            if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
                return initialState;
            }

            const migratedItems = parsed.items
                .map(item => {
                    const normalizedProductId = item.productId;
                    if (!Number.isInteger(normalizedProductId) || normalizedProductId <= 0) {
                        return null;
                    }
                    return {
                        ...item,
                        productId: normalizedProductId,
                        quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
                        price: Number(item.price) || 0,
                        total: Number(item.total) || (Number(item.price) || 0) * (Number(item.quantity) > 0 ? Number(item.quantity) : 1)
                    };
                })
                .filter(Boolean);

            return { ...parsed, items: migratedItems };
        } catch (error) {
            console.error("Failed to parse cart from local storage", error);
            return initialState;
        }
    }
    return initialState;
};

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
