const { parseProductIdParam, parseProductPayload, parseListQuery } = require('./product.validator');
const { BRANDS, FRAGRANCE_FAMILIES } = require('./product.constants');
const { logger } = require('../../shared/logging/logger');

function createProductController({ productService }) {
    return {
        async list(req, res) {
            try { res.json(await productService.list(parseListQuery(req.query))); }
            catch (error) { logger.error('[PRODUCT_LIST_ERROR]', { errorMessage: error.message }); res.status(400).json({ error: error.message || 'Failed to fetch products' }); }
        },
        brands(req, res) { res.json(BRANDS); },
        fragranceFamilies(req, res) { res.json(FRAGRANCE_FAMILIES); },
        async uploadImage(req, res) {
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
            try { const uploaded = await productService.uploadImage(req.file, req.body.productId); return res.json({ imageUrl: uploaded.url, filename: uploaded.path }); }
            catch (error) { logger.error('Supabase image upload failed', { errorMessage: error.message }); return res.status(502).json({ error: 'Image upload failed' }); }
        },
        async getById(req, res) {
            const id = parseProductIdParam(req.params.id);
            if (!id) return res.status(400).json({ error: 'Product ID must be a positive integer' });
            try { const product = await productService.getById(id); return product ? res.json(product) : res.status(404).json({ error: 'Product not found' }); }
            catch (error) { logger.error('[PRODUCT_GET_ERROR]', { productId: id, errorMessage: error.message }); return res.status(500).json({ error: 'Failed to fetch product' }); }
        },
        async create(req, res) {
            let payload;
            try { payload = parseProductPayload(req.body); } catch (error) { return res.status(400).json({ error: error.message }); }
            try { return res.status(201).json(await productService.create(payload)); }
            catch (error) { logger.error('[PRODUCT_CREATE_ERROR]', { errorMessage: error.message }); return res.status(500).json({ error: 'Failed to create product' }); }
        },
        async update(req, res) {
            const id = parseProductIdParam(req.params.id);
            if (!id) return res.status(400).json({ error: 'Product ID must be a positive integer' });
            let stage = 'validate_payload';
            try {
                logger.info('[PUT_TRACE]', { stage: 'controller_received', productId: id, body: req.body });
                const payload = parseProductPayload(req.body);
                logger.info('[PUT_TRACE]', { stage: 'controller_validated', productId: id, payload });
                stage = 'database_update';
                const result = await productService.update(id, payload);
                if (!result) return res.status(404).json({ error: 'Product not found' });
                stage = 'response_serialization';
                logger.info('[PUT_TRACE]', { stage: 'controller_response', productId: id });
                res.json(result.product);
                logger.info('[PRODUCT_UPDATE]', { stage: 'complete', productId: id, imageChanged: result.imageChanged });
            } catch (error) {
                logger.error('[PRODUCT_UPDATE_ERROR]', { stage, productId: id, errorCode: error.code || null, errorMessage: error.message, errorStack: error.stack || null });
                return res.status(stage === 'validate_payload' ? 400 : 500).json({ error: stage === 'validate_payload' ? error.message : 'Failed to update product' });
            }
        },
        async delete(req, res) {
            const id = parseProductIdParam(req.params.id);
            if (!id) return res.status(400).json({ error: 'Product ID must be a positive integer' });
            try { const deleted = await productService.delete(id); return deleted ? res.json({ message: 'Product deleted', id }) : res.status(404).json({ error: 'Product not found' }); }
            catch (error) { logger.error('[PRODUCT_DELETE_ERROR]', { productId: id, errorMessage: error.message }); return res.status(500).json({ error: 'Failed to delete product' }); }
        },
    };
}

module.exports = { createProductController };
