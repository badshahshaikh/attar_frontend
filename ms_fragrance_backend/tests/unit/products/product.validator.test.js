const test = require('node:test');
const assert = require('node:assert/strict');
const { parseProductPayload, parseProductIdParam } = require('../../../src/modules/products/product.validator');

const validPayload = {
    name: 'Verification Attar', price: '99', brand: 'Surrati', fragranceFamily: 'Oud',
    sizes: ['3ml'], sizePricing: { '3ml': 99 }, topNotes: ['Rose'], heartNotes: ['Oud'], baseNotes: ['Musk'],
    inStock: 'true', isNew: 'false', isBestSeller: false, isExclusive: false, featured: false, stockQuantity: '2',
};

test('normalizes a valid PUT payload without dropping product fields', () => {
    const payload = parseProductPayload(validPayload);
    assert.equal(payload.fragranceType, 'Oud');
    assert.equal(payload.price, 99);
    assert.equal(payload.inStock, true);
    assert.equal(payload.stockQuantity, '2');
    assert.deepEqual(payload.sizePricing, { '3ml': 99 });
});

test('rejects invalid product ids before a repository call', () => {
    assert.equal(parseProductIdParam('7'), 7);
    assert.equal(parseProductIdParam('0'), null);
    assert.equal(parseProductIdParam('seven'), null);
});
