const { toProduct, toPersistenceValues } = require('./product.mapper');
const { logger } = require('../../shared/logging/logger');

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
    };
}

module.exports = { createProductService };
