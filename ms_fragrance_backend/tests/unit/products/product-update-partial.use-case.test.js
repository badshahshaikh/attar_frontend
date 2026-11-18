import test from 'node:test';
import assert from 'node:assert/strict';
import UpdateProductUseCase from '../../../src/modules/products/application/use-cases/UpdateProductUseCase.js';

function makeRepository(existingRow, updateResult) {
    let receivedId;
    let receivedUpdates;
    return {
        findById: async (id) => {
            if (id === existingRow.id) return existingRow;
            return null;
        },
        update: async (id, updates) => {
            receivedId = id;
            receivedUpdates = updates;
            return updateResult;
        },
        getReceivedUpdates: () => receivedUpdates,
        getReceivedId: () => receivedId
    };
}

test('updating imageUrl to empty string sets null', async () => {
    const existing = {
        id: 7,
        name: 'Test',
        category: 'Attar',
        fragrance_type: 'Oud',
        description: null,
        full_description: null,
        rating: 0,
        reviews: 0,
        price: 99,
        original_price: null,
        size_pricing: {},
        sizes: [],
        top_notes: [],
        heart_notes: [],
        base_notes: [],
        longevity: '',
        in_stock: true,
        is_new: false,
        brand: 'Surrati',
        is_best_seller: false,
        is_exclusive: false,
        featured: false,
        stock_quantity: 0,
        slug: 'test-7',
        image_url: 'https://example.com/old.jpg',
        image_urls: ['https://example.com/old.jpg'],
        created_at: '2026-01-01',
        updated_at: '2026-01-01'
    };
    const updatedRow = { ...existing, image_url: null, updated_at: '2026-06-01' };
    const repo = makeRepository(existing, updatedRow);
    const storage = null;
    const useCase = new UpdateProductUseCase(repo, storage);

    await useCase.execute(7, { imageUrl: '' });

    const updates = repo.getReceivedUpdates();
    assert.deepEqual(Object.keys(updates), ['image_url'], 'only image_url column should be updated');
    assert.equal(updates.image_url, null);
});

test('updating imageUrl to null sets null', async () => {
    const existing = {
        id: 7,
        name: 'Test',
        category: 'Attar',
        fragrance_type: 'Oud',
        description: null,
        full_description: null,
        rating: 0,
        reviews: 0,
        price: 99,
        original_price: null,
        size_pricing: {},
        sizes: [],
        top_notes: [],
        heart_notes: [],
        base_notes: [],
        longevity: '',
        in_stock: true,
        is_new: false,
        brand: 'Surrati',
        is_best_seller: false,
        is_exclusive: false,
        featured: false,
        stock_quantity: 0,
        slug: 'test-7',
        image_url: 'https://example.com/old.jpg',
        image_urls: ['https://example.com/old.jpg'],
        created_at: '2026-01-01',
        updated_at: '2026-01-01'
    };
    const updatedRow = { ...existing, image_url: null, updated_at: '2026-06-01' };
    const repo = makeRepository(existing, updatedRow);
    const storage = null;
    const useCase = new UpdateProductUseCase(repo, storage);

    await useCase.execute(7, { imageUrl: null });

    const updates = repo.getReceivedUpdates();
    assert.deepEqual(Object.keys(updates), ['image_url'], 'only image_url column should be updated');
    assert.equal(updates.image_url, null);
});

test('omitted fields are not included in update payload', async () => {
    const existing = {
        id: 7,
        name: 'Oud Royale',
        category: 'Attar',
        fragrance_type: 'Oud',
        description: 'A rich oud fragrance',
        full_description: 'Full description',
        rating: 4,
        reviews: 10,
        price: 99,
        original_price: 120,
        size_pricing: { '3ml': 99 },
        sizes: ['3ml'],
        top_notes: ['Rose'],
        heart_notes: ['Oud'],
        base_notes: ['Musk'],
        longevity: 'Long',
        in_stock: true,
        is_new: false,
        brand: 'Surrati',
        is_best_seller: true,
        is_exclusive: false,
        featured: false,
        stock_quantity: 5,
        slug: 'oud-royale-7',
        image_url: 'https://example.com/image.jpg',
        image_urls: ['https://example.com/image.jpg'],
        created_at: '2026-01-01',
        updated_at: '2026-01-01'
    };
    const updatedRow = { ...existing, price: 149, updated_at: '2026-06-01' };
    const repo = makeRepository(existing, updatedRow);
    const storage = null;
    const useCase = new UpdateProductUseCase(repo, storage);

    const result = await useCase.execute(7, { price: 149 });

    const updates = repo.getReceivedUpdates();
    const updateKeys = Object.keys(updates);
    assert.equal(updateKeys.length, 1, 'only price should be updated');
    assert.equal(updateKeys[0], 'price');
    assert.equal(updates.price, 149);
    assert.equal(updates.name, undefined);
    assert.equal(updates.category, undefined);
    assert.equal(updates.longevity, undefined);
    assert.equal(updates.image_url, undefined);
    assert.equal(result.product.id, 7);
    assert.equal(result.product.price, 149);
    assert.equal(result.imageChanged, false);
});

test('updating multiple fields updates only those columns', async () => {
    const existing = {
        id: 7,
        name: 'Oud Royale',
        category: 'Attar',
        fragrance_type: 'Oud',
        description: 'A rich oud fragrance',
        full_description: null,
        rating: 4,
        reviews: 10,
        price: 99,
        original_price: null,
        size_pricing: { '3ml': 99 },
        sizes: ['3ml'],
        top_notes: ['Rose'],
        heart_notes: ['Oud'],
        base_notes: ['Musk'],
        longevity: 'Long',
        in_stock: true,
        is_new: false,
        brand: 'Surrati',
        is_best_seller: true,
        is_exclusive: false,
        featured: false,
        stock_quantity: 5,
        slug: 'oud-royale-7',
        image_url: 'https://example.com/image.jpg',
        image_urls: ['https://example.com/image.jpg'],
        created_at: '2026-01-01',
        updated_at: '2026-01-01'
    };

    const updatedRow = { ...existing, price: 149, brand: 'Al Haramain', updated_at: '2026-06-01' };
    const repo = makeRepository(existing, updatedRow);
    const useCase = new UpdateProductUseCase(repo, null);

    const result = await useCase.execute(7, { price: 149, brand: 'Al Haramain' });

    const updates = repo.getReceivedUpdates();
    assert.deepEqual(Object.keys(updates).sort(), ['brand', 'price']);
    assert.equal(updates.price, 149);
    assert.equal(updates.brand, 'Al Haramain');
    assert.equal(result.product.brand, 'Al Haramain');
});

test('null values are preserved as null in the update', async () => {
    const existing = {
        id: 7,
        name: 'Oud Royale',
        category: 'Attar',
        fragrance_type: 'Oud',
        description: 'Existing description',
        full_description: null,
        rating: 4,
        reviews: 10,
        price: 99,
        original_price: 120,
        size_pricing: { '3ml': 99 },
        sizes: ['3ml'],
        top_notes: ['Rose'],
        heart_notes: ['Oud'],
        base_notes: ['Musk'],
        longevity: 'Long',
        in_stock: true,
        is_new: false,
        brand: 'Surrati',
        is_best_seller: true,
        is_exclusive: false,
        featured: false,
        stock_quantity: 5,
        slug: 'oud-royale-7',
        image_url: 'https://example.com/image.jpg',
        image_urls: ['https://example.com/image.jpg'],
        created_at: '2026-01-01',
        updated_at: '2026-01-01'
    };

    const updatedRow = { ...existing, description: null, original_price: null, updated_at: '2026-06-01' };
    const repo = makeRepository(existing, updatedRow);
    const useCase = new UpdateProductUseCase(repo, null);

    await useCase.execute(7, { description: null, originalPrice: null });

    const updates = repo.getReceivedUpdates();
    assert.equal(updates.description, null);
    assert.equal(updates.original_price, null);
    // Other fields should not be in the update
    assert.equal(updates.name, undefined);
    assert.equal(updates.price, undefined);
});

test('empty string values are converted to null for optional text fields', async () => {
    const existing = {
        id: 7, name: 'Oud Royale', category: 'Attar', fragrance_type: 'Oud',
        description: 'Existing', full_description: null, rating: 4, reviews: 10,
        price: 99, original_price: null, size_pricing: {}, sizes: [],
        top_notes: [], heart_notes: [], base_notes: [], longevity: 'Long',
        in_stock: true, is_new: false, brand: 'Surrati', is_best_seller: true,
        is_exclusive: false, featured: false, stock_quantity: 5,
        slug: 'oud-royale-7', image_url: 'https://example.com/img.jpg',
        image_urls: ['https://example.com/img.jpg'], created_at: '2026-01-01', updated_at: '2026-01-01'
    };
    const repo = makeRepository(existing, { ...existing, longevity: null, updated_at: '2026-06-01' });
    const useCase = new UpdateProductUseCase(repo, null);

    await useCase.execute(7, { longevity: '' });

    const updates = repo.getReceivedUpdates();
    assert.equal(updates.longevity, null);
});

test('returns 404 when product does not exist', async () => {
    const repo = {
        findById: async () => null,
        update: async () => { throw new Error('update should not be called'); }
    };
    const useCase = new UpdateProductUseCase(repo, null);

    await assert.rejects(
        useCase.execute(999, { price: 149 }),
        /Product with ID 999 not found/
    );
});

test('throws when no fields are provided', async () => {
    const existing = { id: 7, name: 'Test', price: 99 };
    const repo = makeRepository(existing, existing);
    const useCase = new UpdateProductUseCase(repo, null);

    await assert.rejects(
        useCase.execute(7, {}),
        /At least one field must be provided/
    );
});

test('imageChanged is true when image URL is replaced', async () => {
    const existing = {
        id: 7, name: 'Test', category: 'Attar', fragrance_type: 'Oud',
        description: null, full_description: null, rating: 0, reviews: 0,
        price: 99, original_price: null, size_pricing: {}, sizes: [],
        top_notes: [], heart_notes: [], base_notes: [], longevity: '',
        in_stock: true, is_new: false, brand: 'Surrati', is_best_seller: false,
        is_exclusive: false, featured: false, stock_quantity: 0,
        slug: 'test-7', image_url: 'https://example.com/old.jpg',
        image_urls: ['https://example.com/old.jpg'], created_at: '2026-01-01', updated_at: '2026-01-01'
    };
    const updatedRow = { ...existing, image_url: 'https://example.com/new.jpg', image_urls: ['https://example.com/new.jpg'], updated_at: '2026-06-01' };
    const repo = makeRepository(existing, updatedRow);
    const storage = {
        getStoragePath: () => '/path',
        removeProductImage: async () => {}
    };
    let removedUrl;
    storage.removeProductImage = async (url) => { removedUrl = url; };
    const useCase = new UpdateProductUseCase(repo, storage);

    const result = await useCase.execute(7, { imageUrl: 'https://example.com/new.jpg' });

    assert.equal(result.imageChanged, true);
    assert.equal(removedUrl, 'https://example.com/old.jpg');
});

test('imageChanged is false when image URL is not provided', async () => {
    const existing = {
        id: 7, name: 'Test', category: 'Attar', fragrance_type: 'Oud',
        description: null, full_description: null, rating: 0, reviews: 0,
        price: 99, original_price: null, size_pricing: {}, sizes: [],
        top_notes: [], heart_notes: [], base_notes: [], longevity: '',
        in_stock: true, is_new: false, brand: 'Surrati', is_best_seller: false,
        is_exclusive: false, featured: false, stock_quantity: 0,
        slug: 'test-7', image_url: 'https://example.com/old.jpg',
        image_urls: ['https://example.com/old.jpg'], created_at: '2026-01-01', updated_at: '2026-01-01'
    };
    const updatedRow = { ...existing, price: 149, updated_at: '2026-06-01' };
    const repo = makeRepository(existing, updatedRow);
    const storage = {
        getStoragePath: () => '/path',
        removeProductImage: async () => { throw new Error('should not be called'); }
    };
    const useCase = new UpdateProductUseCase(repo, storage);

    const result = await useCase.execute(7, { price: 149 });

    assert.equal(result.imageChanged, false);
});
