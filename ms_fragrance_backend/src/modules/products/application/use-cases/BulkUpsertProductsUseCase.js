const { toProduct, toPersistenceValues } = require('../../product.mapper');
const { parseProductPayload, ensureSizeConsistency } = require('../../product.validator');
const database = require('../../../../infrastructure/database/postgres-database');
const { logger } = require('../../../../shared/logging/logger');

/**
 * BulkUpsertProductsUseCase - Business logic for bulk product creation/update
 * 
 * Responsibilities:
 * - Validate all products before database operations
 * - Separate create and update operations
 * - Coordinate transaction for atomic operations
 * - Apply shared validation and normalization
 * - Return meaningful results
 * 
 * This use case is testable with a mocked repository.
 */

class BulkUpsertProductsUseCase {
    constructor(productRepository) {
        this.productRepository = productRepository;
    }

    async execute({ create = [], update = [] }) {
        // Phase 1: Validate all rows before touching the database
        const errors = [];
        const createPayloads = [];
        const updatePayloads = [];

        // Validate create products
        for (let i = 0; i < create.length; i++) {
            try {
                const validated = parseProductPayload(create[i]);
                const normalized = ensureSizeConsistency(validated);
                createPayloads.push(normalized);
            } catch (err) {
                errors.push({ row: i + 1, context: 'create', message: err.message });
            }
        }

        // Validate update products
        for (let i = 0; i < update.length; i++) {
            const item = update[i];
            if (!item.id || !Number.isInteger(Number(item.id)) || Number(item.id) <= 0) {
                errors.push({ row: i + 1, context: 'update', message: 'id must be a positive integer' });
                continue;
            }
            try {
                const validated = parseProductPayload(item);
                const normalized = ensureSizeConsistency(validated);
                updatePayloads.push({ id: Number(item.id), payload: normalized });
            } catch (err) {
                errors.push({ row: i + 1, context: 'update', message: err.message });
            }
        }

        if (errors.length > 0) {
            return { success: false, message: 'Validation failed', errors };
        }

        // Phase 2: Run everything inside a single transaction
        try {
            const result = await database.withTransaction(async (client) => {
                const createdRows = await this.productRepository.bulkCreate(
                    createPayloads.map(toPersistenceValues),
                    client,
                );
                const updatedRows = await this.productRepository.bulkUpdate(
                    updatePayloads.map(({ id, payload }) => ({ 
                        id, 
                        values: toPersistenceValues(payload) 
                    })),
                    client,
                );
                return { created: createdRows, updated: updatedRows };
            });

            logger.info('[BULK_UPSERT]', { 
                created: result.created.length, 
                updated: result.updated.length 
            });

            return {
                success: true,
                created: result.created.length,
                updated: result.updated.length,
                failed: [],
                products: [
                    ...result.created.map(toProduct), 
                    ...result.updated.map(toProduct)
                ],
            };
        } catch (err) {
            logger.error('[BULK_UPSERT_ERROR]', { errorMessage: err.message });
            throw err;
        }
    }
}

module.exports = BulkUpsertProductsUseCase;
