import { logger } from '../../shared/logging/logger.js';

const PUBLIC_FIELDS = [
    'page_type',
    'route_path',
    'seo_title',
    'meta_description',
    'canonical_url',
    'robots',
    'og_title',
    'og_description',
    'og_image',
    'twitter_card',
    'twitter_title',
    'twitter_description',
    'twitter_image',
    'structured_data',
];

function publicRow(row) {
    if (!row) return null;
    const publicData = {};
    for (const field of PUBLIC_FIELDS) {
        if (row[field] !== undefined) publicData[field] = row[field];
    }
    return publicData;
}

function createSeoRepository({ query }) {
    return {
        async getByRoute(route_path) {
            try {
                const result = await query(
                    'SELECT * FROM seo_settings WHERE route_path = $1',
                    [route_path]
                );
                if (result.rows.length === 0) return null;
                return result.rows[0];
            } catch (error) {
                logger.error('[SEO_GET_BY_ROUTE_ERROR]', {
                    route_path,
                    errorMessage: error.message,
                });
                throw error;
            }
        },

        async getPublicByRoute(route_path) {
            try {
                const result = await query(
                    `SELECT ${PUBLIC_FIELDS.join(', ')}
                     FROM seo_settings
                     WHERE route_path = $1 AND is_published = TRUE`,
                    [route_path]
                );
                if (result.rows.length === 0) return null;
                return publicRow(result.rows[0]);
            } catch (error) {
                logger.error('[SEO_GET_PUBLIC_BY_ROUTE_ERROR]', {
                    route_path,
                    errorMessage: error.message,
                });
                throw error;
            }
        },

        async getByProductId(product_id) {
            try {
                const result = await query(
                    `SELECT * FROM seo_settings
                     WHERE page_type = 'product' AND product_id = $1 AND is_published = TRUE
                     ORDER BY id DESC LIMIT 1`,
                    [product_id]
                );
                if (result.rows.length === 0) return null;
                return result.rows[0];
            } catch (error) {
                logger.error('[SEO_GET_BY_PRODUCT_ID_ERROR]', {
                    product_id,
                    errorMessage: error.message,
                });
                throw error;
            }
        },

        async listPublished() {
            try {
                const result = await query(
                    `SELECT ${PUBLIC_FIELDS.join(', ')}, route_path, updated_at
                     FROM seo_settings
                     WHERE is_published = TRUE`,
                );
                return result.rows;
            } catch (error) {
                logger.error('[SEO_LIST_PUBLISHED_ERROR]', { errorMessage: error.message });
                throw error;
            }
        },
        async getAll() {
            try {
                const result = await query(
                    'SELECT * FROM seo_settings ORDER BY page_type, route_path'
                );
                return result.rows;
            } catch (error) {
                logger.error('[SEO_GET_ALL_ERROR]', { errorMessage: error.message });
                throw error;
            }
        },
        async insert(data) {
            try {
                const fields = [
                    'page_type',
                    'route_path',
                    'seo_title',
                    'meta_description',
                    'canonical_url',
                    'robots',
                    'og_title',
                    'og_description',
                    'og_image',
                    'twitter_card',
                    'twitter_title',
                    'twitter_description',
                    'twitter_image',
                    'structured_data',
                    'product_id',
                    'is_published',
                ];
                const values = fields.map((f) => data[f]);
                const placeholders = values
                    .map((_, i) => `$${i + 1}`)
                    .join(', ');

                const result = await query(
                    `INSERT INTO seo_settings (${fields.join(', ')})
                     VALUES (${placeholders})
                     RETURNING *`,
                    values
                );
                return result.rows[0];
            } catch (error) {
                logger.error('[SEO_INSERT_ERROR]', {
                    route_path: data.route_path,
                    errorMessage: error.message,
                });
                throw error;
            }
        },

        async updateByRoute(route_path, data) {
            try {
                const updatableFields = [
                    'page_type',
                    'seo_title',
                    'meta_description',
                    'canonical_url',
                    'robots',
                    'og_title',
                    'og_description',
                    'og_image',
                    'twitter_card',
                    'twitter_title',
                    'twitter_description',
                    'twitter_image',
                    'structured_data',
                    'product_id',
                    'is_published',
                ];

                const assignments = [];
                const values = [];
                let paramIndex = 1;

                for (const field of updatableFields) {
                    if (data[field] === undefined) continue;
                    assignments.push(`${field} = $${paramIndex}`);
                    values.push(data[field]);
                    paramIndex += 1;
                }

                assignments.push('updated_at = NOW()');
                values.push(route_path);

                const result = await query(
                    `UPDATE seo_settings
                     SET ${assignments.join(', ')}
                     WHERE route_path = $${paramIndex}
                     RETURNING *`,
                    values
                );

                if (result.rows.length === 0) return null;
                return result.rows[0];
            } catch (error) {
                logger.error('[SEO_UPDATE_BY_ROUTE_ERROR]', {
                    route_path,
                    errorMessage: error.message,
                });
                throw error;
            }
        },

        async deleteByRoute(route_path) {
            try {
                const result = await query(
                    'DELETE FROM seo_settings WHERE route_path = $1 RETURNING id',
                    [route_path]
                );
                return result.rows[0] || null;
            } catch (error) {
                logger.error('[SEO_DELETE_BY_ROUTE_ERROR]', {
                    route_path,
                    errorMessage: error.message,
                });
                throw error;
            }
        },

    };
}

export { createSeoRepository, publicRow };
