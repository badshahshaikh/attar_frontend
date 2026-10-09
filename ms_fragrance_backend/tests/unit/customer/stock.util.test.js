import test from 'node:test';
import assert from 'node:assert/strict';

// The frontend stock helper is a plain ES module with no browser/JSX deps, so
// it is exercised directly from Node to guarantee the availability rules the
// UI relies on. Keep these cases in lock-step with src/utils/stock.js.
import {
    toStockQuantity,
    isProductAvailable,
    getAvailableStock,
    clampQuantity,
} from '../../../../src/utils/stock.js';

test('toStockQuantity coerces numbers, numeric strings and rejects junk', () => {
    assert.equal(toStockQuantity(5), 5);
    assert.equal(toStockQuantity('5'), 5, 'numeric strings are accepted');
    assert.equal(toStockQuantity(3.9), 3, 'floats floor to an integer');
    assert.equal(toStockQuantity(' 7 '), 7);
    assert.equal(toStockQuantity(0), 0);
    assert.equal(toStockQuantity(null), 0, 'null is not available');
    assert.equal(toStockQuantity(undefined), 0, 'undefined is not available');
    assert.equal(toStockQuantity(''), 0, 'empty string is not available');
    assert.equal(toStockQuantity(-4), 0, 'negatives are not available');
    assert.equal(toStockQuantity('abc'), 0, 'junk is not available');
    assert.equal(toStockQuantity(NaN), 0);
});

test('a product is available only when inStock is true AND quantity > 0', () => {
    assert.equal(isProductAvailable({ inStock: true, stockQuantity: 3 }), true);
    assert.equal(isProductAvailable({ inStock: true, stockQuantity: 0 }), false, 'zero stock is unavailable');
    assert.equal(isProductAvailable({ inStock: false, stockQuantity: 5 }), false, 'flagged out of stock');
    assert.equal(isProductAvailable({ inStock: true, stockQuantity: '2' }), true, 'numeric string counts');
    assert.equal(isProductAvailable({ inStock: true }), false, 'missing quantity is unavailable');
    assert.equal(isProductAvailable({ inStock: true, stockQuantity: null }), false, 'null quantity is unavailable');
    assert.equal(isProductAvailable({ inStock: 'true', stockQuantity: 5 }), false, 'inStock must be exactly true');
    assert.equal(isProductAvailable(null), false);
});

test('getAvailableStock returns 0 for unavailable products and the qty otherwise', () => {
    assert.equal(getAvailableStock({ inStock: true, stockQuantity: 4 }), 4);
    assert.equal(getAvailableStock({ inStock: true, stockQuantity: 0 }), 0);
    assert.equal(getAvailableStock({ inStock: false, stockQuantity: 9 }), 0);
});

test('clampQuantity never exceeds available stock and never goes negative', () => {
    const product = { inStock: true, stockQuantity: 3 };

    assert.equal(clampQuantity(2, product), 2);
    assert.equal(clampQuantity(10, product), 3, 'capped at stock');
    assert.equal(clampQuantity(0, product), 0);
    assert.equal(clampQuantity(-5, product), 0, 'negatives floor to 0');
    assert.equal(clampQuantity('9', product), 3, 'numeric string capped');
    assert.equal(clampQuantity(2, { inStock: true, stockQuantity: 0 }), 0, 'out of stock clamps to 0');
    assert.equal(clampQuantity(2, null), 0);
});
