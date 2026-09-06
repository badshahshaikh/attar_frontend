const { PRODUCT_COLUMNS, PRODUCT_WRITE_COLUMNS } = require('./product.constants');
const { logger } = require('../../shared/logging/logger');

function createProductRepository({ query }) {
    return {
        async findAll(filters) {
            const conditions = [];
            const values = [];
            if (filters.search) {
                const search = `%${String(filters.search).trim()}%`;
                conditions.push('(name ILIKE $1 OR description ILIKE $1 OR brand ILIKE $1 OR fragrance_type ILIKE $1 OR category ILIKE $1)');
                values.push(search);
            }
            for (const [name, column] of [['brand', 'brand'], ['fragranceFamily', 'fragrance_type'], ['category', 'category']]) {
                if (filters[name]) { conditions.push(`${column} = $${values.length + 1}`); values.push(String(filters[name])); }
            }
            for (const [name, column] of [['isBestSeller', 'is_best_seller'], ['isExclusive', 'is_exclusive'], ['featured', 'featured']]) {
                if (filters[name] !== undefined) { conditions.push(`${column} = $${values.length + 1}`); values.push(filters[name]); }
            }
            const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            const count = await query(`SELECT COUNT(*)::int AS total FROM products ${where}`, values);
            const limitIndex = values.length + 1;
            const offsetIndex = values.length + 2;
            const products = await query(`SELECT ${PRODUCT_COLUMNS} FROM products ${where} ORDER BY id ASC LIMIT $${limitIndex} OFFSET $${offsetIndex}`, [...values, filters.limit, (filters.page - 1) * filters.limit]);
            return { rows: products.rows, total: count.rows[0].total };
        },
        async findById(id) {
            const result = await query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = $1`, [id]);
            return result.rows[0] || null;
        },
        async findImageById(id) {
            const result = await query('SELECT image_url FROM products WHERE id = $1', [id]);
            return result.rows[0] || null;
        },
        async create(values) {
            const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
            const result = await query(`INSERT INTO products (${PRODUCT_WRITE_COLUMNS.join(', ')}) VALUES (${placeholders}) RETURNING ${PRODUCT_COLUMNS}`, values);
            return result.rows[0];
        },
        async update(id, values) {
            const assignments = PRODUCT_WRITE_COLUMNS.map((column, index) => `${column} = $${index + 1}`).join(', ');
            const sql = `UPDATE products SET ${assignments}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING ${PRODUCT_COLUMNS}`;
            const parameters = [...values, id];
            logger.info('[PUT_TRACE]', { stage: 'repository_update_start', productId: id, sql, parameters });
            try {
                const result = await query(sql, parameters);
                logger.info('[PUT_TRACE]', { stage: 'repository_update_complete', productId: id, rowReturned: Boolean(result.rows[0]) });
                return result.rows[0] || null;
            } catch (error) {
                logger.error('[PUT_TRACE]', { stage: 'repository_update_error', productId: id, errorCode: error.code || null, errorDetail: error.detail || null, errorMessage: error.message, errorStack: error.stack || null });
                throw error;
            }
        },
        async delete(id) {
            const result = await query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
            return result.rows[0] || null;
        },
    };
}

module.exports = { createProductRepository };
