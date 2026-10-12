import { logger } from '../../shared/logging/logger.js';
import AppError from '../../core/errors/AppError.js';

const ORDER_COLUMNS = `id, order_number, status, subtotal, shipping, total,
    contact_name, contact_phone, shipping_address, notes, source,
    payment_status, razorpay_order_id, razorpay_payment_id, created_at, updated_at`;

const ITEM_COLUMNS = `id, order_id, product_id, product_name, size, quantity, unit_price, line_total`;

function createCustomerOrderRepository({ query, withTransaction }) {
    return {
        // Product rows used to snapshot name and price onto the order. Prices are
        // always read from the database, never from the request.
        async findProductsByIds(ids) {
            const result = await query(
                'SELECT id, name, price, size_pricing, in_stock, stock_quantity FROM public.products WHERE id = ANY($1::bigint[])',
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

        // Records the Razorpay order id against our order when a payment is
        // initiated. Returns the updated row, or null when the order does not
        // belong to this user (the service turns that into a 404).
        async linkRazorpayOrder(userId, orderNumber, razorpayOrderId) {
            try {
                const result = await query(
                    `UPDATE public.orders
                        SET razorpay_order_id = $3, updated_at = NOW()
                      WHERE user_id = $1 AND order_number = $2
                      RETURNING ${ORDER_COLUMNS}`,
                    [userId, orderNumber, razorpayOrderId]
                );

                const order = result.rows[0];

                if (!order) return null;

                const items = await query(
                    `SELECT ${ITEM_COLUMNS} FROM public.order_items WHERE order_id = $1 ORDER BY id ASC`,
                    [order.id]
                );

                return stitchItems([order], items.rows)[0];
            } catch (error) {
                logger.error('[CUSTOMER_ORDER_LINK_ERROR]', { userId, orderNumber, errorMessage: error.message });
                throw error;
            }
        },

        // Webhook lookup: no user session here, so match on the Razorpay
        // order id we stored when the payment session was created.
        async findByRazorpayOrderId(razorpayOrderId) {
            const result = await query(
                `SELECT ${ORDER_COLUMNS} FROM public.orders WHERE razorpay_order_id = $1`,
                [razorpayOrderId]
            );

            const order = result.rows[0];

            if (!order) return null;

            const items = await query(
                `SELECT ${ITEM_COLUMNS} FROM public.order_items WHERE order_id = $1 ORDER BY id ASC`,
                [order.id]
            );

            return stitchItems([order], items.rows)[0];
        },

        // Marks an order paid. Idempotent: paying an already-paid order is a
        // no-op returning the current row, so retries and duplicate webhooks
        // can never double-apply a payment.
        async markPaid({ orderId, razorpayOrderId, razorpayPaymentId }) {
            try {
                const result = await query(
                    `UPDATE public.orders
                        SET payment_status = 'paid',
                            status = 'paid',
                            razorpay_order_id = COALESCE($2, razorpay_order_id),
                            razorpay_payment_id = $3,
                            updated_at = NOW()
                      WHERE id = $1 AND payment_status <> 'paid'
                      RETURNING ${ORDER_COLUMNS}`,
                    [orderId, razorpayOrderId || null, razorpayPaymentId]
                );

                const order = result.rows[0];

                if (!order) {
                    const current = await query(
                        `SELECT ${ORDER_COLUMNS} FROM public.orders WHERE id = $1`,
                        [orderId]
                    );

                    if (current.rows[0]?.payment_status === 'paid') return current.rows[0];

                    return null;
                }

                const items = await query(
                    `SELECT ${ITEM_COLUMNS} FROM public.order_items WHERE order_id = $1 ORDER BY id ASC`,
                    [order.id]
                );

                return stitchItems([order], items.rows)[0];
            } catch (error) {
                logger.error('[CUSTOMER_ORDER_PAID_ERROR]', { orderId, errorMessage: error.message });
                throw error;
            }
        },

        // ── Admin listing ───────────────────────────────────────────────────
        // All orders across every customer, LEFT JOINed to the owning account
        // for name/email/phone. user_id is nullable (history survives account
        // deletion), so contact_* remains the fallback. Explicit columns only —
        // u.password_hash is never selected.
        async findAllAdmin({ search = '', status = '', paymentStatus = '', page = 1, limit = 50 } = {}) {
            const conditions = [];
            const values = [];

            const term = String(search || '').trim();
            if (term) {
                values.push(`%${term}%`);
                conditions.push(`(o.order_number ILIKE $1
                    OR u.full_name ILIKE $1
                    OR u.email ILIKE $1
                    OR u.phone ILIKE $1
                    OR o.contact_name ILIKE $1
                    OR o.contact_phone ILIKE $1)`);
            }

            if (status) {
                values.push(status);
                conditions.push(`o.status = $${values.length}`);
            }

            if (paymentStatus) {
                values.push(paymentStatus);
                conditions.push(`o.payment_status = $${values.length}`);
            }

            const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

            const countResult = await query(
                `SELECT COUNT(*)::int AS total
                 FROM public.orders o
                 LEFT JOIN public.users u ON u.id = o.user_id
                 ${where}`,
                values
            );

            const limitIndex = values.length + 1;
            const offsetIndex = values.length + 2;

            const result = await query(
                `SELECT o.id, o.order_number, o.user_id, o.status, o.payment_status,
                        o.subtotal, o.shipping, o.total,
                        o.contact_name, o.contact_phone, o.created_at, o.updated_at,
                        o.delivered_at,
                        u.full_name, u.email, u.phone
                 FROM public.orders o
                 LEFT JOIN public.users u ON u.id = o.user_id
                 ${where}
                 ORDER BY o.created_at DESC, o.id DESC
                 LIMIT $${limitIndex}
                 OFFSET $${offsetIndex}`,
                [...values, limit, (page - 1) * limit]
            );

            return {
                rows: result.rows,
                total: countResult.rows[0].total
            };
        },

        // Single order for the admin View action: full order columns + the
        // joined account, then stitched with its order_items rows.
        async findByIdAdmin(id) {
            const result = await query(
                `SELECT o.id, o.order_number, o.user_id, o.status, o.payment_status,
                        o.subtotal, o.shipping, o.total,
                        o.contact_name, o.contact_phone, o.shipping_address, o.notes, o.source,
                        o.created_at, o.updated_at, o.delivered_at,
                        u.full_name, u.email, u.phone
                 FROM public.orders o
                 LEFT JOIN public.users u ON u.id = o.user_id
                 WHERE o.id = $1`,
                [id]
            );

            const order = result.rows[0];
            if (!order) return null;

            const items = await query(
                `SELECT ${ITEM_COLUMNS} FROM public.order_items WHERE order_id = $1 ORDER BY id ASC`,
                [id]
            );

            return stitchItems([order], items.rows)[0];
        },

        // ── Admin status update ───────────────────────────────────────────
        // Updates ONLY the status columns explicitly supplied (status and/or
        // payment_status) and leaves every other column — subtotal, shipping,
        // total, stock-affecting fields, razorpay ids — untouched. When the new
        // order status is 'delivered', delivered_at is stamped exactly once
        // (first stamp wins via COALESCE) so the 7-day return window is stable;
        // an explicit deliveredAt (validated by the caller) supports backfills.
        // Column names are built from a fixed allow-list in the caller, never
        // from raw input, and every value is passed as a parameterized bind.
        async updateOrderStatus(id, { status, paymentStatus, deliveredAt = null }) {
            const assignments = [];
            const values = [];

            if (status !== undefined) {
                values.push(status);
                assignments.push(`status = $${values.length}`);

                if (status === 'delivered') {
                    // Explicit admin date wins, the existing stamp is preserved,
                    // otherwise the stamp is taken now. The COALESCE chain means
                    // a re-mark never moves the 7-day return window.
                    values.push(deliveredAt);
                    assignments.push(`delivered_at = COALESCE(delivered_at, $${values.length}::timestamptz, NOW())`);
                }
            }

            if (paymentStatus !== undefined) {
                values.push(paymentStatus);
                assignments.push(`payment_status = $${values.length}`);
            }

            // Caller guarantees at least one field, but guard defensively so a
            // stray call can never issue an UPDATE with an empty SET clause.
            if (assignments.length === 0) {
                return this.findByIdAdmin(id);
            }

            assignments.push('updated_at = NOW()');
            values.push(id);

            const result = await query(
                `UPDATE public.orders
                    SET ${assignments.join(', ')}
                  WHERE id = $${values.length}
                  RETURNING id`,
                values
            );

            // No row updated means the order does not exist.
            if (result.rows.length === 0) return null;

            // Read the row back through the same admin query as the View action
            // so the response is identical to a freshly fetched order.
            return this.findByIdAdmin(id);
        },

        async create(userId, { orderNumber, address, contactName, contactPhone, notes, source, lines, subtotal, shipping, total }) {
            try {
                return await withTransaction(async (client) => {
                    // Atomically reserve stock BEFORE inserting the order. Each
                    // product row is locked FOR UPDATE so two customers buying
                    // the last unit serialise; the UPDATE only succeeds when
                    // stock_quantity is still >= the requested amount, so an
                    // overselling race loses and the thrown error rolls the
                    // whole transaction back (no partial order, no partial
                    // deduction). in_stock is kept in sync: false at zero,
                    // true whenever positive stock remains.
                    for (const line of lines) {
                        const needed = Number(line.quantity) || 0;
                        const locked = await client.query(
                            `SELECT id, name, in_stock, stock_quantity FROM public.products WHERE id = $1 FOR UPDATE`,
                            [line.productId]
                        );
                        const product = locked.rows[0];

                        if (!product) {
                            throw new AppError(
                                'One of the products in your cart no longer exists',
                                400,
                                'PRODUCT_MISSING'
                            );
                        }

                        const deducted = await client.query(
                            `UPDATE public.products
                                SET stock_quantity = stock_quantity - $2,
                                    in_stock = (stock_quantity - $2) > 0,
                                    updated_at = NOW()
                              WHERE id = $1 AND stock_quantity >= $2 AND in_stock = TRUE
                              RETURNING stock_quantity`,
                            [line.productId, needed]
                        );

                        if (deducted.rows.length === 0) {
                            // Distinguish the two guard failures: the product was
                            // disabled by an admin (in_stock FALSE) or there are
                            // genuinely not enough units. Both roll the whole
                            // transaction back with a clear 409.
                            if (product.in_stock === false) {
                                throw new AppError(
                                    `Sorry, "${product.name}" is currently out of stock`,
                                    409,
                                    'INSUFFICIENT_STOCK'
                                );
                            }

                            const available = Number(product.stock_quantity) || 0;
                            throw new AppError(
                                `Sorry, "${product.name}" has only ${available} unit${available === 1 ? '' : 's'} left`,
                                409,
                                'INSUFFICIENT_STOCK'
                            );
                        }
                    }

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