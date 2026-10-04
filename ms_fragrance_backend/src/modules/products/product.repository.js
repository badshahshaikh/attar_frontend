import {
    PRODUCT_COLUMNS,
    PRODUCT_WRITE_COLUMNS,
} from './product.constants.js';
import { logger } from '../../shared/logging/logger.js';
// const { where, values } = buildProductWhere(filters);
import { buildProductWhere } from './product.query-builder.js';

function createProductRepository({ query }) {
    // Helper: run a query using an explicit pg client (for transactions) or the default pool.
    async function run(sql, values, client) {
        if (client) return client.query(sql, values);
        return query(sql, values);
    }
    return {

        async findAll(filters) {
            console.log('FILTERS:', filters);

            const { where, values } = buildProductWhere(filters);

            console.log('GENERATED WHERE:', where);
            console.log('QUERY VALUES:', values);

            // Count matching products
            const countResult = await query(
                `
            SELECT COUNT(*)::int AS total
            FROM products
            ${where}
        `,
                values
            );

            // Fetch paginated products
            const limitIndex = values.length + 1;
            const offsetIndex = values.length + 2;

            const productsResult = await query(
                `
            SELECT ${PRODUCT_COLUMNS}
            FROM products
            ${where}
            ORDER BY id ASC
            LIMIT $${limitIndex}
            OFFSET $${offsetIndex}
        `,
                [
                    ...values,
                    filters.limit,
                    (filters.page - 1) * filters.limit
                ]
            );

            return {
                rows: productsResult.rows,
                total: countResult.rows[0].total
            };
        },
        async findById(id) {
            const result = await query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = $1`, [id]);
            return result.rows[0] || null;
        },
        async findImageById(id) {
            const result = await query('SELECT image_url, image_urls FROM products WHERE id = $1', [id]);
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
        async bulkCreate(products, client) {
            const placeholders = PRODUCT_WRITE_COLUMNS.map((_, i) => `$${i + 1}`).join(', ');
            const insertSql = `INSERT INTO products (${PRODUCT_WRITE_COLUMNS.join(', ')}) VALUES (${placeholders}) RETURNING ${PRODUCT_COLUMNS}`;
            const rows = [];
            for (const values of products) {
                const result = await run(insertSql, values, client);
                if (result.rows[0]) rows.push(result.rows[0]);
            }
            return rows;
        },
        async bulkUpdate(products, client) {
            const assignments = PRODUCT_WRITE_COLUMNS.map((col, i) => `${col} = $${i + 1}`).join(', ');
            const updateSql = `UPDATE products SET ${assignments}, updated_at = NOW() WHERE id = $${PRODUCT_WRITE_COLUMNS.length + 1} RETURNING ${PRODUCT_COLUMNS}`;
            const rows = [];
            for (const { id, values } of products) {
                const result = await run(updateSql, [...values, id], client);
                if (result.rows[0]) rows.push(result.rows[0]);
            }
            return rows;
        },
    };
}

export { createProductRepository };