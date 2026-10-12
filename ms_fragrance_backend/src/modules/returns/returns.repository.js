import { logger } from '../../shared/logging/logger.js';
import AppError from '../../core/errors/AppError.js';

/**
 * returns.repository.js — Persistence for admin-managed returns.
 *
 * Conventions mirrored from customer-order.repository.js:
 * - Parameterized queries only; dynamic identifiers never come from input.
 * - `query` for single-statement reads/writes, `withTransaction(client)`
 *   for every multi-statement mutation.
 */

const RETURN_COLUMNS = `r.id, r.return_number, r.order_id, r.status,
    r.customer_reason, r.internal_notes, r.unopened_confirmed,
    r.inspected_at,
    r.delivered_at_snapshot, r.days_after_delivery,
    r.created_by_admin_id, r.created_by_admin_name,
    r.created_at, r.updated_at,
    o.order_number, o.status AS order_status, o.total AS order_total, o.delivered_at,
    rf.amount AS refund_amount, rf.method AS refund_method, rf.refunded_at`;

function createReturnsRepository({ query, withTransaction }) {
    return {
        // ── Listing ───────────────────────────────────────────────
        // Searches the return number, order number and customer identity
        // (account + guest contact snapshot), mirroring the admin orders
        // search so admins find returns the same way they find orders.
        async findAllAdmin({ search = '', status = '', page = 1, limit = 20 } = {}) {
            const conditions = [];
            const values = [];

            const term = String(search || '').trim();
            if (term) {
                values.push(`%${term}%`);
                conditions.push(`(r.return_number ILIKE $1
                    OR o.order_number ILIKE $1
                    OR u.full_name ILIKE $1
                    OR u.email ILIKE $1
                    OR u.phone ILIKE $1
                    OR o.contact_name ILIKE $1
                    OR o.contact_phone ILIKE $1)`);
            }

            if (status) {
                values.push(status);
                conditions.push(`r.status = $${values.length}`);
            }

            const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

            const countResult = await query(
                `SELECT COUNT(*)::int AS total
                   FROM public.returns r
                   JOIN public.orders o ON o.id = r.order_id
                   LEFT JOIN public.users u ON u.id = o.user_id
                   ${where}`,
                values
            );

            const result = await query(
                `SELECT ${RETURN_COLUMNS}
                   FROM public.returns r
                   JOIN public.orders o ON o.id = r.order_id
                   LEFT JOIN public.users u ON u.id = o.user_id
                   LEFT JOIN public.return_refunds rf ON rf.return_id = r.id
                   ${where}
                   ORDER BY r.created_at DESC, r.id DESC
                   LIMIT $${values.length + 1}
                   OFFSET $${values.length + 2}`,
                [...values, limit, (page - 1) * limit]
            );

            return { rows: result.rows, total: countResult.rows[0].total };
        },

        // ── Reads used by eligibility + creation ──────────────────
        // Order header + items + per-item already-returned quantities.
        // The locked (Tx) variant runs inside the create transaction so two
        // admins creating returns for the same order serialise on the row.
        async findOrderForEligibility(orderId) {
            const result = await query(
                `SELECT o.id, o.order_number, o.user_id, o.status, o.total,
                        o.contact_name, o.contact_phone,
                        o.created_at, o.updated_at, o.delivered_at,
                        u.full_name, u.email, u.phone
                   FROM public.orders o
                   LEFT JOIN public.users u ON u.id = o.user_id
                  WHERE o.id = $1`,
                [orderId]
            );

            if (!result.rows[0]) return null;

            const items = await query(
                `SELECT id, order_id, product_id, product_name, size,
                        quantity, unit_price, line_total
                   FROM public.order_items
                  WHERE order_id = $1
                  ORDER BY id ASC`,
                [orderId]
            );

            const returned = await query(
                `SELECT ri.order_item_id,
                        COALESCE(SUM(ri.quantity), 0)::int AS returned_quantity
                   FROM public.return_items ri
                   JOIN public.returns r ON r.id = ri.return_id
                  WHERE r.order_id = $1 AND r.status <> 'rejected'
                  GROUP BY ri.order_item_id`,
                [orderId]
            );

            return {
                order: result.rows[0],
                items: items.rows,
                returnedByItem: new Map(
                    returned.rows.map((row) => [Number(row.order_item_id), Number(row.returned_quantity)])
                ),
            };
        },

        async findOrderForEligibilityTx(client, orderId) {
            const locked = await client.query(
                `SELECT id, order_number, status, total, delivered_at
                   FROM public.orders
                  WHERE id = $1 FOR UPDATE`,
                [orderId]
            );

            if (!locked.rows[0]) return null;

            const items = await client.query(
                `SELECT id, order_id, product_id, product_name, size,
                        quantity, unit_price, line_total
                   FROM public.order_items
                  WHERE order_id = $1
                  ORDER BY id ASC`,
                [orderId]
            );

            const returned = await client.query(
                `SELECT ri.order_item_id,
                        COALESCE(SUM(ri.quantity), 0)::int AS returned_quantity
                   FROM public.return_items ri
                   JOIN public.returns r ON r.id = ri.return_id
                  WHERE r.order_id = $1 AND r.status <> 'rejected'
                  GROUP BY ri.order_item_id`,
                [orderId]
            );

            return {
                order: locked.rows[0],
                items: items.rows,
                returnedByItem: new Map(
                    returned.rows.map((row) => [Number(row.order_item_id), Number(row.returned_quantity)])
                ),
            };
        },

        // ── Detail read ───────────────────────────────────────────
        // Full return with items, history timeline and optional refund.
        async findByIdAdmin(id) {
            const result = await query(
                `SELECT ${RETURN_COLUMNS}
                   FROM public.returns r
                   JOIN public.orders o ON o.id = r.order_id
                   LEFT JOIN public.return_refunds rf ON rf.return_id = r.id
                  WHERE r.id = $1`,
                [id]
            );

            const header = result.rows[0];
            if (!header) return null;

            const items = await query(
                `SELECT ri.id, ri.return_id, ri.order_item_id, ri.product_id,
                        ri.product_name, ri.size, ri.quantity,
                        ri.unit_price, ri.line_total,
                        ri.stock_restored, ri.restored_at,
                        oi.quantity AS ordered_quantity
                   FROM public.return_items ri
                   JOIN public.order_items oi ON oi.id = ri.order_item_id
                  WHERE ri.return_id = $1
                  ORDER BY ri.id ASC`,
                [id]
            );

            const history = await query(
                `SELECT id, return_id, from_status, to_status,
                        changed_by_admin_id, changed_by_admin_name, note, created_at
                   FROM public.return_status_history
                  WHERE return_id = $1
                  ORDER BY created_at ASC, id ASC`,
                [id]
            );

            const refund = await query(
                `SELECT id, return_id, amount, refunded_at, method, reference,
                        recorded_by_admin_id, recorded_by_admin_name, created_at
                   FROM public.return_refunds
                  WHERE return_id = $1`,
                [id]
            );

            const orderSnapshot = await query(
                `SELECT o.id, o.order_number, o.status, o.payment_status,
                        o.subtotal, o.shipping, o.total,
                        o.contact_name, o.contact_phone,
                        o.created_at, o.delivered_at,
                        u.full_name, u.email, u.phone
                   FROM public.orders o
                   LEFT JOIN public.users u ON u.id = o.user_id
                  WHERE o.id = $1`,
                [header.order_id]
            );

            const snapshot = orderSnapshot.rows[0] || null;

            return {
                ...header,
                items: items.rows,
                history: history.rows,
                refund: refund.rows[0] || null,
                orderSnapshot: snapshot
                    ? {
                        id: snapshot.id,
                        orderNumber: snapshot.order_number,
                        status: snapshot.status,
                        paymentStatus: snapshot.payment_status,
                        subtotal: snapshot.subtotal,
                        shipping: snapshot.shipping,
                        total: snapshot.total,
                        customerName: snapshot.full_name || snapshot.contact_name || '',
                        customerPhone: snapshot.phone || snapshot.contact_phone || '',
                        orderDate: snapshot.created_at,
                        deliveredAt: snapshot.delivered_at,
                    }
                    : null,
            };
        },

        // ── Creation ──────────────────────────────────────────────
        // Inserts the return + items + initial history row in ONE transaction.
        // The caller performs eligibility + quota math on the locked snapshot
        // and passes the final item lines; the UNIQUE(return_id, order_item_id)
        // constraint is the last line of defence against duplicates.
        async createReturnTx(client, { returnNumber, orderId, customerReason, internalNotes, deliveredAt, daysAfterDelivery, admin, lines }) {
            const inserted = await client.query(
                `INSERT INTO public.returns
                    (return_number, order_id, status, customer_reason, internal_notes,
                     unopened_confirmed, delivered_at_snapshot, days_after_delivery,
                     created_by_admin_id, created_by_admin_name)
                 VALUES ($1,$2,'requested',$3,$4,TRUE,$5,$6,$7,$8)
                 RETURNING id`,
                [
                    returnNumber, orderId, customerReason, internalNotes || null,
                    deliveredAt, daysAfterDelivery, admin.id, admin.name,
                ]
            );

            const returnId = inserted.rows[0].id;

            for (const line of lines) {
                await client.query(
                    `INSERT INTO public.return_items
                        (return_id, order_item_id, product_id, product_name,
                         size, quantity, unit_price, line_total)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                    [
                        returnId, line.orderItemId, line.productId, line.productName,
                        line.size, line.quantity, line.unitPrice, line.lineTotal,
                    ]
                );
            }

            await client.query(
                `INSERT INTO public.return_status_history
                    (return_id, from_status, to_status,
                     changed_by_admin_id, changed_by_admin_name, note)
                 VALUES ($1, NULL, 'requested', $2, $3, $4)`,
                [returnId, admin.id, admin.name, 'Return created by admin']
            );

            return returnId;
        },

        // ── Status transition ─────────────────────────────────────
        // Conditional single-statement update (id + expected current status)
        // so a concurrent transition loses instead of overwriting.
        async transitionStatusTx(client, returnId, fromStatus, toStatus, admin, note) {
            const updated = await client.query(
                `UPDATE public.returns
                    SET status = $2, updated_at = NOW()
                  WHERE id = $1 AND status = $3
                  RETURNING id, order_id, status`,
                [returnId, toStatus, fromStatus]
            );

            if (updated.rows.length === 0) return null;

            await client.query(
                `INSERT INTO public.return_status_history
                    (return_id, from_status, to_status,
                     changed_by_admin_id, changed_by_admin_name, note)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                [returnId, fromStatus, toStatus, admin.id, admin.name, note || null]
            );

            return updated.rows[0];
        },

        // ── Inspection confirmation ───────────────────────────────
        // Persists the admin's explicit inspection confirmation in the same
        // transaction that transitions the return. The `inspected_at IS NULL`
        // guard makes a second confirmation impossible (returns null), so the
        // confirmation itself can never be applied twice.
        async confirmInspectionTx(client, returnId) {
            const result = await client.query(
                `UPDATE public.returns
                    SET inspected_at = NOW(), updated_at = NOW()
                  WHERE id = $1 AND inspected_at IS NULL
                  RETURNING id, inspected_at`,
                [returnId]
            );

            return result.rows[0] || null;
        },

        // ── Stock restoration (inspection-confirmed only) ─────────
        // Refuses to run unless the inspection confirmation has been
        // persisted on the return row — stock restoration always requires an
        // explicit, stored confirmation, never a request-only flag. Each
        // not-yet-restored line is then locked (FOR UPDATE) and flipped via
        // the existing `stock_restored = FALSE` guard, so a retry can never
        // double-add; the product row is locked too (checkout pattern).
        // in_stock is kept in sync the way checkout does, but only re-opens a
        // product that was auto-disabled at zero stock — an intentionally
        // admin-disabled product (in_stock FALSE while it still holds units)
        // keeps its flag.
        async restoreStockTx(client, returnId) {
            // Defensive gate: without a persisted confirmation there is no
            // lawful path to stock restoration.
            const guard = await client.query(
                `SELECT inspected_at FROM public.returns WHERE id = $1 FOR UPDATE`,
                [returnId]
            );

            if (!guard.rows[0] || !guard.rows[0].inspected_at) {
                throw new AppError(
                    'Confirm the inspection before restoring stock',
                    422,
                    'RETURN_INSPECTION_REQUIRED'
                );
            }

            const lines = await client.query(
                `SELECT ri.id, ri.product_id, ri.quantity
                   FROM public.return_items ri
                  WHERE ri.return_id = $1 AND ri.stock_restored = FALSE
                  ORDER BY ri.id ASC
                  FOR UPDATE`,
                [returnId]
            );

            const restored = [];

            for (const line of lines.rows) {
                const markDone = () => client.query(
                    `UPDATE public.return_items
                        SET stock_restored = TRUE, restored_at = NOW()
                      WHERE id = $1 AND stock_restored = FALSE`,
                    [line.id]
                );

                // Snapshot lines keep product_id NULL when the product was
                // deleted after purchase — nothing to restore, just mark done.
                if (!line.product_id) {
                    await markDone();
                    continue;
                }

                const locked = await client.query(
                    `SELECT id FROM public.products WHERE id = $1 FOR UPDATE`,
                    [line.product_id]
                );

                if (!locked.rows[0]) {
                    await markDone();
                    continue;
                }

                // Restore the units and re-open the product only when it was
                // auto-disabled at zero stock (the checkout invariant). An
                // admin-disabled product — FALSE while stock_quantity > 0 —
                // keeps its flag, so intentional disables are preserved.
                await client.query(
                    `UPDATE public.products
                        SET stock_quantity = stock_quantity + $2,
                            in_stock = CASE
                                WHEN in_stock = FALSE AND stock_quantity = 0 THEN TRUE
                                ELSE in_stock
                            END,
                            updated_at = NOW()
                      WHERE id = $1`,
                    [line.product_id, line.quantity]
                );

                await markDone();
                restored.push({ productId: Number(line.product_id), quantity: Number(line.quantity) });
            }

            return restored;
        },

        // Fetch the current return header with a row lock (status/refund flows).
        async findForUpdateTx(client, returnId) {
            const result = await client.query(
                `SELECT id, return_number, order_id, status, inspected_at
                   FROM public.returns
                  WHERE id = $1 FOR UPDATE`,
                [returnId]
            );

            return result.rows[0] || null;
        },

        // Server-computed refundable ceiling: sum of returned line totals.
        async sumReturnLinesTx(client, returnId) {
            const result = await client.query(
                `SELECT COALESCE(SUM(line_total), 0) AS total
                   FROM public.return_items
                  WHERE return_id = $1`,
                [returnId]
            );

            return Number(result.rows[0]?.total || 0);
        },

        // ── Refund (record-refund endpoint only) ──────────────────
        // Inserts the single refund row (UNIQUE blocks a second one), flips
        // the return to `refunded` only from `refund_pending`, and writes the
        // history row — all in the caller's transaction so the money record
        // and the terminal state can never diverge.
        async recordRefundTx(client, returnId, { amount, method, reference, refundedAt }, admin) {
            const transitioned = await client.query(
                `UPDATE public.returns
                    SET status = 'refunded', updated_at = NOW()
                  WHERE id = $1 AND status = 'refund_pending'
                  RETURNING id`,
                [returnId]
            );

            if (transitioned.rows.length === 0) return null;

            const inserted = await client.query(
                `INSERT INTO public.return_refunds
                    (return_id, amount, refunded_at, method, reference,
                     recorded_by_admin_id, recorded_by_admin_name)
                 VALUES ($1,$2,COALESCE($3, NOW()),$4,$5,$6,$7)
                 RETURNING id, return_id, amount, refunded_at, method, reference,
                           recorded_by_admin_id, recorded_by_admin_name, created_at`,
                [
                    returnId, amount, refundedAt || null, method, reference || null,
                    admin.id, admin.name,
                ]
            );

            await client.query(
                `INSERT INTO public.return_status_history
                    (return_id, from_status, to_status,
                     changed_by_admin_id, changed_by_admin_name, note)
                 VALUES ($1,'refund_pending','refunded',$2,$3,$4)`,
                [returnId, admin.id, admin.name, `Manual refund of ${amount} recorded (${method})`]
            );

            return inserted.rows[0];
        },

        // ── Delivered stamp (orders flow) ─────────────────────────
        // First stamp wins (COALESCE), so re-marking delivered never moves
        // the return window; an explicit past date supports backfills.
        async stampDeliveredAt(orderId, deliveredAt) {
            const result = await query(
                `UPDATE public.orders
                    SET delivered_at = COALESCE(delivered_at, $2::timestamptz),
                        updated_at = NOW()
                  WHERE id = $1
                  RETURNING id, order_number, status, delivered_at`,
                [orderId, deliveredAt || new Date().toISOString()]
            );

            return result.rows[0] || null;
        },
    };
}

export { createReturnsRepository };





