import database from '../../../../infrastructure/database/postgres-database.js';
import { logger } from '../../../../shared/logging/logger.js';

/**
 * DeleteProductsUseCase - Business logic for bulk product deletion
 *
 * Responsibilities:
 * - Validate the submitted ID list (de-duplicated positive integers)
 * - Read image references and delete the rows inside a single transaction
 * - Report exactly which IDs were deleted and which were not found
 * - Best-effort image cleanup after a successful commit
 *
 * The transaction guarantees the database is either fully updated for this
 * request or unchanged, so partial failures never leave a half-applied batch.
 * This use case is testable with a mocked repository (transaction runner can
 * be injected).
 */

class DeleteProductsUseCase {
    constructor(productRepository, storage, transactionRunner = database.withTransaction) {
        this.productRepository = productRepository;
        this.storage = storage;
        this.transactionRunner = transactionRunner;
    }

    async cleanupImage(imageUrl, productId = null) {
        if (!this.storage || !this.storage.getStoragePath(imageUrl)) return;
        try {
            await this.storage.removeProductImage(imageUrl);
        } catch (error) {
            logger.error('[PRODUCT_BULK_DELETE_ERROR]', {
                stage: 'supabase_delete',
                productId,
                errorCode: error.code || null,
                errorMessage: error.message
            });
        }
    }

    async execute(ids) {
        try {
            const uniqueIds = [...new Set(ids)];

            const result = await this.transactionRunner(async (client) => {
                // Read image references first so cleanup data is available
                // inside the same consistent snapshot as the delete.
                const images = await this.productRepository.findImagesByIds(uniqueIds, client);
                const deletedIds = await this.productRepository.deleteProductsByIds(uniqueIds, client);
                return { images, deletedIds };
            });

            const deletedSet = new Set(result.deletedIds);
            const notFoundIds = uniqueIds.filter((id) => !deletedSet.has(id));

            // Best-effort image cleanup for rows that were actually deleted.
            for (const image of result.images) {
                if (!deletedSet.has(image.id)) continue;

                const urls = [
                    image.image_url,
                    ...(Array.isArray(image.image_urls) ? image.image_urls : [])
                ].filter(Boolean);

                for (const url of new Set(urls)) {
                    await this.cleanupImage(url, image.id);
                }
            }

            logger.info('[DELETE_PRODUCTS]', {
                requested: uniqueIds.length,
                deleted: result.deletedIds.length,
                notFound: notFoundIds.length
            });

            return {
                deletedIds: result.deletedIds,
                deletedCount: result.deletedIds.length,
                notFoundIds
            };
        } catch (error) {
            logger.error('[PRODUCT_BULK_DELETE_ERROR]', {
                requestedIds: ids.length,
                errorMessage: error.message
            });
            throw error;
        }
    }
}

export default DeleteProductsUseCase;