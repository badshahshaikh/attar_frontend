import test from 'node:test';
import assert from 'node:assert/strict';
import { toPersistenceValues, toProduct } from '../../../src/modules/products/product.mapper.js';

test('maps normalized API payloads to the 25 repository values in column order', () => {
    const values = toPersistenceValues({
        name: 'Verification Attar', price: 99, brand: 'Surrati', fragranceType: 'Oud',
        sizePricing: { '3ml': 99 }, sizes: ['3ml'], topNotes: [], heartNotes: [], baseNotes: [],
    });
    assert.equal(values.length, 25);
    assert.equal(values[0], 'Verification Attar');
    assert.equal(values[2], 'Oud');
    assert.equal(values[7], 99);
    assert.equal(values[9], JSON.stringify({ '3ml': 99 }));
    assert.equal(values[23], null);
    assert.equal(values[24], JSON.stringify([]));
});

test('toProduct maps snake_case stock columns to camelCase availability fields', () => {
    const row = {
        id: 2,
        name: 'Mitti Attar',
        price: 499,
        original_price: null,
        rating: 4,
        reviews: 10,
        // The live PostgreSQL shape: BOOLEAN in_stock, INTEGER stock_quantity.
        in_stock: true,
        stock_quantity: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
    };

    const product = toProduct(row);

    assert.equal(product.inStock, true, 'in_stock maps to inStock');
    assert.equal(product.stockQuantity, 0, 'stock_quantity maps to stockQuantity (0 stays 0)');
});

test('toProduct preserves disabled and positive-stock states from the database', () => {
    const base = {
        id: 3,
        name: 'Oud',
        price: 999,
        original_price: null,
        rating: 4,
        reviews: 1,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
    };

    const disabled = toProduct({ ...base, in_stock: false, stock_quantity: 10 });
    assert.equal(disabled.inStock, false, 'disabled product stays disabled');
    assert.equal(disabled.stockQuantity, 10, 'disabled product keeps its stock number');

    const stocked = toProduct({ ...base, in_stock: true, stock_quantity: 7 });
    assert.equal(stocked.inStock, true);
    assert.equal(stocked.stockQuantity, 7);

    const nullStock = toProduct({ ...base, in_stock: true, stock_quantity: null });
    assert.equal(nullStock.stockQuantity, 0, 'NULL stock_quantity normalizes to 0');
});
