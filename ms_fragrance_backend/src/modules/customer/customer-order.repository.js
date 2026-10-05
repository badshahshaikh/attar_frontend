import { logger } from '../../shared/logging/logger.js';

const ORDER_COLUMNS = `id, order_number, status, subtotal, shipping, total,
    contact_name, contact_phone, shipping_address, notes, source, created_at, updated_at`;

const ITEM_COLUMNS = `id, order_id, product_id, product_name, size, quantity, unit_price, line_total`;

function createCustomerOrderRepository({ query, withTransaction }) {
    return {
        // Product rows used to snapshot name and price onto the order. Prices are
        // always read from the database, never from the request.
        async findProductsByIds(ids) {
            const result = await query(
                'SELECT id, name, price, size_pricing FROM public.products WHERE id = ANY($1::bigint[])',
                [ids]
            );
            return result.rows;
        },

        async list(userId, limit = 50) {
            try {
                const result = await query(
                    `SELECT ${ORDER_COLUMNS} FROM public.orders
                     WHERE user_id = $1
                     ORDER BY created_at DESC
                     LIMIT $2`,
                    [userId, limit]
                );

                const orders = result.rows;

                if (orders.length === 0) return [];

                const items = await query(
                    `SELECT ${ITEM_COLUMNS} FROM public.order_items
                     WHERE order_id = ANY($1::bigint[])
                     ORDER BY id ASC`,
                    [orders.map(order => order.id)]
                );

                return stitchItems(orders, items.rows);
            } catch (error) {
                logger.error('[CUSTOMER_ORDER_LIST_ERROR]', { userId, errorMessage: error.message });
                throw error;
            }
        },

        async findByOrderNumber(userId, orderNumber) {
            const result = await query(
                `SELECT ${ORDER_COLUMNS} FROM public.orders WHERE user_id = $1 AND order_number = $2`,
                [userId, orderNumber]
            );

            const order = result.rows[0];

            if (!order) return null;

            const items = await query(
                `SELECT ${ITEM_COLUMNS} FROM public.order_items WHERE order_id = $1 ORDER BY id ASC`,
                [order.id]
            );

            return stitchItems([order], items.rows)[0];
        },

        async create(userId, { orderNumber, address, contactName, contactPhone, notes, source, lines, subtotal, shipping, total }) {
            try {
                return await withTransaction(async (client) => {
                    const inserted = await client.query(
                        `INSERT INTO public.orders
                            (order_number, user_id, status, subtotal, shipping, total,
                             contact_name, contact_phone, shipping_address, notes, source)
                         VALUES ($1,$2,'placed',$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
                         RETURNING ${ORDER_COLUMNS}`,
                        [
                            orderNumber, userId, subtotal, shipping, total,
                            contactName, contactPhone, JSON.stringify(address),
                            notes, source,
                        ]
                    );

                    const order = inserted.rows[0];

                    for (const line of lines) {
                        await client.query(
                            `INSERT INTO public.order_items
                                (order_id, product_id, product_name, size, quantity, unit_price, line_total)
                             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                            [order.id, line.productId, line.productName, line.size, line.quantity, line.unitPrice, line.lineTotal]
                        );
                    }

                    // Read the rows back so a freshly created order has exactly the
                    // same shape as one fetched from GET /orders.
                    const savedItems = await client.query(
                        `SELECT ${ITEM_COLUMNS} FROM public.order_items WHERE order_id = $1 ORDER BY id ASC`,
                        [order.id]
                    );

                    return stitchItems([order], savedItems.rows)[0];
                });
            } catch (error) {
                logger.error('[CUSTOMER_ORDER_CREATE_ERROR]', { userId, errorMessage: error.message });
                throw error;
            }
        },
    };
}

// Attach each order its line items in one pass instead of querying per order.
function stitchItems(orders, items) {
    const byOrderId = new Map();

    items.forEach((item) => {
        if (!byOrderId.has(item.order_id)) {
            byOrderId.set(item.order_id, []);
        }
        byOrderId.get(item.order_id).push(item);
    });

    return orders.map((order) => ({ ...order, items: byOrderId.get(order.id) || [] }));
}

export { createCustomerOrderRepository };