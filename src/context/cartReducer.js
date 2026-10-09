/**
 * cartReducer.js - Pure cart state logic (no JSX) so it can be exercised
 * directly from Node in tests/unit/customer/cart.reducer.test.js, following
 * the same pattern as src/utils/stock.js.
 *
 * Stock rules enforced here:
 * - Every cart line stores the latest known `inStock`/`stockQuantity` snapshot.
 * - Merging a line always copies the freshest snapshot onto it, so later
 *   clamps never operate on stale stock data.
 * - A product whose latest known stock is zero (or which is flagged out of
 *   stock) can never enter the cart.
 * - All quantity changes go through src/utils/stock.js so the UI can never
 *   hold more units than are available.
 *
 * The backend remains the authoritative guard: it re-validates stock and
 * deducts atomically when the order is placed.
 */
import { clampQuantity, isProductAvailable } from '../utils/stock.js';

const initialState = { items: [] };

// Legacy baskets (saved before stock metadata existed) must keep their
// quantities: clamp them only once a stock snapshot is present, otherwise
// clampQuantity would treat "unknown" as zero and wipe the basket. The cart
// revalidates against the backend (REFRESH_STOCK) as soon as it mounts.
const hasStockMetadata = (item) =>
    item.inStock !== undefined || item.stockQuantity !== undefined;

const cartReducer = (state = initialState, action) => {
    switch (action.type) {
        case 'ADD_TO_CART': {
            const newItem = action.payload;
            const existingItemIndex = state.items.findIndex(
                item => item.productId === newItem.productId && item.size === newItem.size
            );

            if (existingItemIndex !== -1) {
                const existingItem = state.items[existingItemIndex];
                // The payload carries the freshest snapshot - always copy it
                // onto the stored line so its stock metadata is never stale.
                const refreshedItem = {
                    ...existingItem,
                    inStock: newItem.inStock,
                    stockQuantity: newItem.stockQuantity,
                };
                const mergedQuantity = clampQuantity(
                    existingItem.quantity + newItem.quantity,
                    refreshedItem
                );
                const updatedItems = [...state.items];
                updatedItems[existingItemIndex] = {
                    ...refreshedItem,
                    quantity: mergedQuantity,
                    total: mergedQuantity * existingItem.price,
                };
                return { ...state, items: updatedItems };
            }

            // Never let a product whose latest known stock is zero (or which is
            // flagged out of stock) enter the cart in the first place.
            if (!isProductAvailable(newItem)) {
                return state;
            }

            const quantity = clampQuantity(newItem.quantity, newItem);
            if (quantity < 1) {
                return state;
            }

            const item = { ...newItem, quantity, total: quantity * newItem.price };
            return { ...state, items: [...state.items, item] };
        }
        case 'REFRESH_STOCK': {
            // payload: [{ productId, inStock, stockQuantity }] - the latest
            // backend stock for the products currently in the basket. Lines
            // clamp down to the fresh numbers (shrinking to 0 when the product
            // sold out) and never grow: adding units is a deliberate action.
            const snapshots = new Map(
                (action.payload || []).map(snapshot => [Number(snapshot.productId), snapshot])
            );

            if (snapshots.size === 0) return state;

            let changed = false;
            const items = state.items.map(item => {
                const snapshot = snapshots.get(Number(item.productId));
                if (!snapshot) return item;

                const refreshedItem = {
                    ...item,
                    inStock: snapshot.inStock,
                    stockQuantity: snapshot.stockQuantity,
                };
                const quantity = clampQuantity(refreshedItem.quantity, refreshedItem);

                if (
                    refreshedItem.inStock === item.inStock &&
                    refreshedItem.stockQuantity === item.stockQuantity &&
                    quantity === item.quantity
                ) {
                    return item;
                }

                changed = true;
                return { ...refreshedItem, quantity, total: quantity * refreshedItem.price };
            });

            return changed ? { ...state, items } : state;
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
                    const safeQuantity = clampQuantity(quantity, item);
                    return { ...item, quantity: safeQuantity, total: safeQuantity * item.price };
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

/**
 * Rebuild cart state from a persisted JSON string (or null when absent).
 *
 * Pure so tests can drive hydration without a browser. Quantities are clamped
 * against the stored stock snapshot when one exists; legacy items saved before
 * stock metadata existed keep their quantity until the cart revalidates them
 * against the backend (REFRESH_STOCK), so a stale basket is never wiped just
 * because it predates the stock fields.
 */
const hydrateCart = (savedCart, fallbackState) => {
    if (!savedCart) return fallbackState;

    try {
        const parsed = JSON.parse(savedCart);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
            return fallbackState;
        }

        const migratedItems = parsed.items
            .map(item => {
                const normalizedProductId = item.productId;
                if (!Number.isInteger(normalizedProductId) || normalizedProductId <= 0) {
                    return null;
                }

                const price = Number(item.price) || 0;
                const rawQuantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
                const quantity = hasStockMetadata(item)
                    ? clampQuantity(rawQuantity, item)
                    : rawQuantity;

                return {
                    ...item,
                    productId: normalizedProductId,
                    price,
                    quantity,
                    total: price * quantity,
                };
            })
            .filter(Boolean);

        return { ...parsed, items: migratedItems };
    } catch (error) {
        console.error('Failed to parse cart from local storage', error);
        return fallbackState;
    }
};

export { initialState, cartReducer, hasStockMetadata, hydrateCart };