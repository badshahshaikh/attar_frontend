import test from 'node:test';
import assert from 'node:assert/strict';
import { toPersistenceValues } from '../../../src/modules/products/product.mapper.js';

test('maps normalized API payloads to the 24 repository values in column order', () => {
    const values = toPersistenceValues({
        name: 'Verification Attar', price: 99, brand: 'Surrati', fragranceType: 'Oud',
        sizePricing: { '3ml': 99 }, sizes: ['3ml'], topNotes: [], heartNotes: [], baseNotes: [],
    });
    assert.equal(values.length, 24);
    assert.equal(values[0], 'Verification Attar');
    assert.equal(values[2], 'Oud');
    assert.equal(values[7], 99);
    assert.equal(values[9], JSON.stringify({ '3ml': 99 }));
    assert.equal(values[23], null);
});
