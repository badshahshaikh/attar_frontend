import test from 'node:test';
import assert from 'node:assert/strict';

// The cart reducer is a plain ES module (no JSX) so it can be exercised
// directly from Node, mirroring stock.util.test.js. These cases pin the stale
// cart-data rules: merge metadata refresh, zero-stock add rejection, the
// backend stock refresh, and localStorage hydration.
import {
    cartReducer,
    initialState,
    hydrateCart,
    hasStockMetadata,
} from '../../../../src/context/cartReducer.js';

const line = (overrides = {}) => ({
    productId: 3,
    size: '3ml',
    name: 'Mogra Attar',
    price: 100,
    image: '',
    inStock: true,
    stockQuantity: 10,
    quantity: 1,
    total: 100,
    ...overrides,
});

const add = (payload) => ({ type: 'ADD_TO_CART', payload });
const refresh = (payload) => ({ type: 'REFRESH_STOCK', payload });
const updateQuantity = (productId, size, quantity) => ({
    type: 'UPDATE_QUANTITY',
    payload: { productId, size, quantity },
});

test('ADD_TO_CART refuses a product whose latest known stock is zero', () => {
    const state = cartReducer(initialState, add(line({ stockQuantity: 0 })));

    assert.equal(state.items.length, 0, 'a zero-stock product must not enter the cart');
});

test('ADD_TO_CART refuses a product flagged out of stock even with quantity', () => {
    const state = cartReducer(initialState, add(line({ inStock: false, stockQuantity: 5 })));

    assert.equal(state.items.length, 0, 'inStock=false must not enter the cart');
});

test('ADD_TO_CART clamps the requested quantity to available stock', () => {
    const state = cartReducer(initialState, add(line({ stockQuantity: 2, quantity: 5 })));

    assert.equal(state.items.length, 1);
    assert.equal(state.items[0].quantity, 2, 'quantity is capped at stockQuantity');
    assert.equal(state.items[0].total, 200, 'total follows the clamped quantity');
});

test('merging an existing line refreshes its stock metadata from the payload', () => {
    // The stored line carries an old snapshot (stock 10); the payload has the
    // fresh backend numbers (stock 1). The merged sum (2 + 1) clamps down to
    // the fresh ceiling of 1 - a line can never hold more than is available.
    const start = cartReducer(initialState, add(line({ stockQuantity: 10, quantity: 2 })));
    const merged = cartReducer(start, add(line({ stockQuantity: 1, quantity: 1 })));

    assert.equal(merged.items.length, 1);
    assert.equal(merged.items[0].stockQuantity, 1, 'stale stock metadata must be overwritten');
    assert.equal(merged.items[0].quantity, 1, 'merged quantity clamps to the fresh snapshot');
    assert.equal(merged.items[0].total, 100, 'total follows the clamped quantity');
});

test('merging with a fresh zero-stock snapshot clamps the line instead of trusting stale stock', () => {
    const start = cartReducer(initialState, add(line({ stockQuantity: 10, quantity: 2 })));
    const merged = cartReducer(start, add(line({ stockQuantity: 0, quantity: 1 })));

    assert.equal(merged.items[0].stockQuantity, 0, 'metadata reflects the fresh zero stock');
    assert.equal(merged.items[0].quantity, 0, 'quantity clamps to zero');
    assert.equal(merged.items[0].total, 0);
});

test('REFRESH_STOCK clamps stale cart lines down to the latest backend stock', () => {
    const stale = cartReducer(initialState, add(line({ stockQuantity: 10, quantity: 5 })));

    const refreshed = cartReducer(stale, refresh([
        { productId: 3, inStock: true, stockQuantity: 2 },
    ]));

    assert.equal(refreshed.items[0].stockQuantity, 2);
    assert.equal(refreshed.items[0].quantity, 2, 'stale quantity clamps down to backend stock');
    assert.equal(refreshed.items[0].total, 200);
});

test('REFRESH_STOCK marks a sold-out line unavailable and clamps it to zero', () => {
    const stale = cartReducer(initialState, add(line({ stockQuantity: 7, quantity: 3 })));

    const refreshed = cartReducer(stale, refresh([
        { productId: 3, inStock: true, stockQuantity: 0 },
    ]));

    assert.equal(refreshed.items[0].stockQuantity, 0);
    assert.equal(refreshed.items[0].quantity, 0, 'sold-out line clamps to zero');
    assert.equal(refreshed.items[0].total, 0);
    assert.equal(hasStockMetadata(refreshed.items[0]), true);
});

test('REFRESH_STOCK marks a disabled (inStock=false) line unavailable', () => {
    const stale = cartReducer(initialState, add(line({ inStock: true, stockQuantity: 4, quantity: 2 })));

    const refreshed = cartReducer(stale, refresh([
        { productId: 3, inStock: false, stockQuantity: 4 },
    ]));

    assert.equal(refreshed.items[0].inStock, false);
    assert.equal(refreshed.items[0].quantity, 0, 'disabled products clamp to zero');
});

test('REFRESH_STOCK never increases a line beyond what the user selected', () => {
    const state = cartReducer(initialState, add(line({ stockQuantity: 1, quantity: 1 })));

    const refreshed = cartReducer(state, refresh([
        { productId: 3, inStock: true, stockQuantity: 99 },
    ]));

    assert.equal(refreshed.items[0].quantity, 1, 'refresh only clamps down, never up');
});

test('REFRESH_STOCK returns the same state when nothing changed (no re-render loop)', () => {
    const state = cartReducer(initialState, add(line({ stockQuantity: 10, quantity: 1 })));

    const refreshed = cartReducer(state, refresh([
        { productId: 3, inStock: true, stockQuantity: 10 },
    ]));

    assert.equal(refreshed, state, 'an unchanged refresh must not produce a new state');
});

test('UPDATE_QUANTITY cannot increment past available stock', () => {
    const state = cartReducer(initialState, add(line({ stockQuantity: 2, quantity: 2 })));

    const updated = cartReducer(state, updateQuantity(3, '3ml', 5));

    assert.equal(updated.items[0].quantity, 2, 'increment clamps to stockQuantity');
});

test('UPDATE_QUANTITY on a zero-stock line clamps to zero instead of staying purchasable', () => {
    const state = cartReducer(initialState, add(line({ stockQuantity: 3, quantity: 2 })));
    const soldOut = cartReducer(state, refresh([{ productId: 3, inStock: true, stockQuantity: 0 }]));

    const updated = cartReducer(soldOut, updateQuantity(3, '3ml', 3));

    assert.equal(updated.items[0].quantity, 0, 'zero stock means zero purchasable units');
});

test('hydrateCart clamps persisted stale quantities against the stored snapshot', () => {
    const persisted = JSON.stringify({
        items: [line({ stockQuantity: 2, quantity: 5, total: 500 })],
    });

    const state = hydrateCart(persisted, initialState);

    assert.equal(state.items.length, 1);
    assert.equal(state.items[0].quantity, 2, 'hydration clamps to the stored snapshot');
    assert.equal(state.items[0].total, 200, 'total recomputed from the clamped quantity');
});

test('hydrateCart clamps a persisted zero-stock line to zero', () => {
    const persisted = JSON.stringify({
        items: [line({ stockQuantity: 0, quantity: 4, total: 400 })],
    });

    const state = hydrateCart(persisted, initialState);

    assert.equal(state.items[0].quantity, 0);
    assert.equal(state.items[0].total, 0);
});

test('hydrateCart keeps legacy items without stock metadata until the backend refresh', () => {
    // Baskets written before stock fields existed must not be wiped by
    // hydration (unknown stock would clamp to 0); REFRESH_STOCK fixes them.
    const persisted = JSON.stringify({
        items: [{ productId: 3, size: '3ml', name: 'Mogra', price: 100, quantity: 2, total: 200 }],
    });

    const state = hydrateCart(persisted, initialState);

    assert.equal(state.items.length, 1);
    assert.equal(state.items[0].quantity, 2, 'legacy items survive hydration untouched');
    assert.equal(hasStockMetadata(state.items[0]), false);
});

test('hydrateCart drops invalid items and falls back on corrupt JSON', () => {
    const withInvalid = JSON.stringify({
        items: [line(), { ...line(), productId: -1 }, { ...line(), productId: 'abc' }],
    });

    const state = hydrateCart(withInvalid, initialState);
    assert.equal(state.items.length, 1, 'invalid product ids are dropped');

    assert.equal(hydrateCart('not-json', initialState), initialState, 'corrupt JSON falls back');
    assert.equal(hydrateCart(null, initialState), initialState, 'absent cart falls back');
});