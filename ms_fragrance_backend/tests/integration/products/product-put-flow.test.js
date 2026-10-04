import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductRepository } from '../../../src/modules/products/product.repository.js';
import UpdateProductUseCase from '../../../src/modules/products/application/use-cases/UpdateProductUseCase.js';
import { toPersistenceValues } from '../../../src/modules/products/product.mapper.js';

test('useCase invokes the repository UPDATE with 25 ordered values followed by the id', async () => {
    const calls = [];
    const row = { id: 42, name: 'Verification Attar', category: 'Attar', fragrance_type: 'Oud', price: '99', original_price: null, size_pricing: {}, sizes: [], top_notes: [], heart_notes: [], base_notes: [], in_stock: true, is_new: false, brand: 'Surrati', is_best_seller: false, is_exclusive: false, featured: false, stock_quantity: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
    const repository = createProductRepository({
        query: async (sql, values) => {
            calls.push({ sql, values });
            if (sql.startsWith('SELECT image_url')) return { rows: [{ image_url: '' }] };
            if (sql.startsWith('UPDATE products')) return { rows: [row] };
            throw new Error(`Unexpected SQL: ${sql}`);
        }
    });
    const useCase = new UpdateProductUseCase(repository, { getStoragePath: () => null, removeProductImage: async () => { } });
    const payload = { name: 'Verification Attar', price: 99, brand: 'Surrati', fragranceType: 'Oud', sizes: [], sizePricing: {}, topNotes: [], heartNotes: [], baseNotes: [] };

    const result = await useCase.execute(42, payload);

    assert.equal(result.product.id, 42);
    assert.equal(calls.length, 2);
    assert.match(calls[1].sql, /^UPDATE products SET /);
    assert.match(calls[1].sql, /WHERE id = \$26 RETURNING/);
    assert.deepEqual(calls[1].values, [...toPersistenceValues(payload), 42]);
});
