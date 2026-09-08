const { toProduct, toPersistenceValues } = require('./product.mapper');
const { parseProductPayload } = require('./product.validator');
const { logger } = require('../../shared/logging/logger');
const database = require('../../infrastructure/database/postgres-database');

function createProductService({ productRepository, storage }) {
    async function cleanupImage(imageUrl, productId = null) {
        if (!storage.getStoragePath(imageUrl)) return;
        try { await storage.removeProductImage(imageUrl); }
        catch (error) {
            logger.error('[PRODUCT_UPDATE_ERROR]', { stage: 'supabase_delete', productId, errorCode: error.code || null, errorMessage: error.message });
        }
    }

    return {
        async list(filters) {
            const { rows, total } = await productRepository.findAll(filters);
            const totalPages = Math.ceil(total / filters.limit);
            return { products: rows.map(toProduct), pagination: { page: filters.page, limit: filters.limit, totalProducts: total, totalPages, hasNextPage: filters.page < totalPages, hasPreviousPage: filters.page > 1 } };
        },
        async getById(id) {
            const row = await productRepository.findById(id);
            return row ? toProduct(row) : null;
        },
        async create(payload) { return toProduct(await productRepository.create(toPersistenceValues(payload))); },
        async update(id, payload) {
            logger.info('[PUT_TRACE]', { stage: 'service_find_existing_start', productId: id });
            const previous = await productRepository.findImageById(id);
            logger.info('[PUT_TRACE]', { stage: 'service_repository_update_start', productId: id });
            const row = await productRepository.update(id, toPersistenceValues(payload));
            if (!row) return null;
            logger.info('[PUT_TRACE]', { stage: 'service_repository_update_complete', productId: id });
            const imageChanged = Boolean(previous && previous.image_url !== row.image_url);
            if (imageChanged) await cleanupImage(previous.image_url, id);
            logger.info('[PUT_TRACE]', { stage: 'service_mapper_start', productId: id });
            return { product: toProduct(row), imageChanged };
        },
        async delete(id) {
            const existing = await productRepository.findImageById(id);
            const deleted = await productRepository.delete(id);
            if (!deleted) return null;
            if (existing) await cleanupImage(existing.image_url);
            return deleted;
        },
        async uploadImage(file, productId) {
            const safeProductId = String(productId || 'new').replace(/[^a-zA-Z0-9_-]/g, '-');
            const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.mimetype];
            return storage.uploadProductImage(file, `products/product-${safeProductId}/image-${Date.now()}.${extension}`);
        },
        async bulkUpsert({ create = [], update = [] }) {
            // --- Phase 1: validate all rows before touching the database ---
            const errors = [];
            const createPayloads = [];
            const updatePayloads = [];

            for (let i = 0; i < create.length; i++) {
                try {
                    createPayloads.push(parseProductPayload(create[i]));
                } catch (err) {
                    errors.push({ row: i + 1, context: 'create', message: err.message });
                }
            }
            for (let i = 0; i < update.length; i++) {
                const item = update[i];
                if (!item.id || !Number.isInteger(Number(item.id)) || Number(item.id) <= 0) {
                    errors.push({ row: i + 1, context: 'update', message: 'id must be a positive integer' });
                    continue;
                }
                try {
                    updatePayloads.push({ id: Number(item.id), payload: parseProductPayload(item) });
                } catch (err) {
                    errors.push({ row: i + 1, context: 'update', message: err.message });
                }
            }

            if (errors.length > 0) {
                return { success: false, message: 'Validation failed', errors };
            }

            // --- Phase 2: run everything inside a single transaction ---
            try {
                const result = await database.withTransaction(async (client) => {
                    const createdRows = await productRepository.bulkCreate(
                        createPayloads.map(toPersistenceValues),
                        client,
                    );
                    const updatedRows = await productRepository.bulkUpdate(
                        updatePayloads.map(({ id, payload }) => ({ id, values: toPersistenceValues(payload) })),
                        client,
                    );
                    return { created: createdRows, updated: updatedRows };
                });
                logger.info('[BULK_UPSERT]', { created: result.created.length, updated: result.updated.length });
                return {
                    success: true,
                    created: result.created.length,
                    updated: result.updated.length,
                    failed: [],
                    products: [...result.created.map(toProduct), ...result.updated.map(toProduct)],
                };
            } catch (err) {
                logger.error('[BULK_UPSERT_ERROR]', { errorMessage: err.message });
                throw err;
            }
        },
    };
}

module.exports = { createProductService };
