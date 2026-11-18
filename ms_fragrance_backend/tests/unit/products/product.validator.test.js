import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProductPayload, parseProductIdParam, parsePartialProductPayload } from '../../../src/modules/products/product.validator.js';

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
    assert.equal(payload.stockQuantity, 2);
    assert.deepEqual(payload.sizePricing, { '3ml': 99 });
});

test('rejects invalid product ids before a repository call', () => {
    assert.equal(parseProductIdParam('7'), 7);
    assert.equal(parseProductIdParam('0'), null);
    assert.equal(parseProductIdParam('seven'), null);
});

// ── parsePartialProductPayload tests ──────────────────────────────────

test('partial payload returns only the provided price field', () => {
    const payload = parsePartialProductPayload({ price: 149 });
    assert.equal(payload.price, 149);
    assert.equal(Object.keys(payload).length, 1);
    assert.equal(payload.name, undefined);
    assert.equal(payload.brand, undefined);
});

test('partial payload preserves explicitly supplied null values', () => {
    const payload = parsePartialProductPayload({
        price: 149,
        description: null,
        originalPrice: null,
        slug: null
    });
    assert.equal(payload.price, 149);
    assert.equal(payload.description, null);
    assert.equal(payload.originalPrice, null);
    assert.equal(payload.slug, null);
    // Fields not provided must be absent
    assert.equal(payload.name, undefined);
    assert.equal(payload.category, undefined);
});

test('partial payload treats empty string as explicit null for optional text', () => {
    const payload = parsePartialProductPayload({
        price: 149,
        description: '',
        longevity: ''
    });
    assert.equal(payload.description, null);
    assert.equal(payload.longevity, null);
});

test('partial payload treats empty string as explicit null for imageUrl', () => {
    const payload = parsePartialProductPayload({
        price: 149,
        imageUrl: ''
    });
    assert.equal(payload.imageUrl, null);
    // Fields not provided must be absent
    assert.equal(payload.name, undefined);
    assert.equal(payload.category, undefined);
});

test('partial payload preserves explicitly supplied null for imageUrl', () => {
    const payload = parsePartialProductPayload({
        price: 149,
        imageUrl: null
    });
    assert.equal(payload.imageUrl, null);
    // Fields not provided must be absent
    assert.equal(payload.name, undefined);
    assert.equal(payload.category, undefined);
});

test('partial payload normalizes boolean string values', () => {
    const payload = parsePartialProductPayload({ inStock: 'false', isNew: 'true' });
    assert.equal(payload.inStock, false);
    assert.equal(payload.isNew, true);
});

test('partial payload rejects negative price', () => {
    assert.throws(() => parsePartialProductPayload({ price: -10 }), /non-negative number/);
});

test('partial payload rejects missing fragrance family when provided as empty', () => {
    assert.throws(() => parsePartialProductPayload({ fragranceFamily: '' }), /Fragrance family/);
});

test('partial payload throws when no fields are provided', () => {
    assert.throws(() => parsePartialProductPayload({}), /At least one field must be provided/);
    assert.throws(() => parsePartialProductPayload({ productId: 7 }), /At least one field must be provided/);
});

test('partial payload accepts fragranceFamily mapped to fragranceType', () => {
    const payload = parsePartialProductPayload({ fragranceFamily: 'Musk' });
    assert.equal(payload.fragranceType, 'Musk');
    assert.equal(payload.fragranceFamily, undefined);
});

test('partial payload accepts fragranceType directly', () => {
    const payload = parsePartialProductPayload({ fragranceType: 'Amber' });
    assert.equal(payload.fragranceType, 'Amber');
});

test('partial payload normalizes sizePricing and derives sizes', () => {
    const payload = parsePartialProductPayload({ sizePricing: { '3ml': 99, '6ml': 149 } });
    assert.deepEqual(payload.sizePricing, { '3ml': 99, '6ml': 149 });
    assert.deepEqual(payload.sizes, ['3ml', '6ml']);
});

test('partial payload accepts sizes without sizePricing (does not auto-generate pricing)', () => {
    const payload = parsePartialProductPayload({ sizes: ['3ml', '6ml'] });
    assert.deepEqual(payload.sizes, ['3ml', '6ml']);
    assert.equal(payload.sizePricing, undefined);
});

test('partial payload validates array fields when provided', () => {
    assert.throws(() => parsePartialProductPayload({ sizes: 'not-an-array' }), /must be an array/);
});

test('partial payload validates sizePricing must be an object', () => {
    assert.throws(() => parsePartialProductPayload({ sizePricing: 'not-an-object' }), /sizePricing must be an object/);
});
