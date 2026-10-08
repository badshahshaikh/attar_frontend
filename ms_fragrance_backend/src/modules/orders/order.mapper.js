import { normalizeShippingAddress, toCamelOrderItem } from '../customer/customer.mapper.js';

/**
 * order.mapper.js — Maps admin order rows (public.orders LEFT JOIN
 * public.users) to the API shape.
 *
 * Only explicitly selected columns are exposed. password_hash and any other
 * authentication material are never part of the join select, so they can
 * never appear in a response.
 */

function toAdminOrder(row) {
    if (!row) return null;

    return {
        id: row.id,
        orderNumber: row.order_number,
        customerId: row.user_id ?? null,
        // Joined account is the registered customer; contact_* is the snapshot
        // taken at checkout and the fallback when the account was deleted.
        customerName: row.full_name || row.contact_name || '',
        customerEmail: row.email || '',
        customerPhone: row.phone || row.contact_phone || '',
        contactName: row.contact_name || '',
        contactPhone: row.contact_phone || '',
        status: row.status,
        paymentStatus: row.payment_status || 'unpaid',
        subtotal: row.subtotal,
        shipping: row.shipping,
        total: row.total,
        orderDate: row.created_at,
        updatedAt: row.updated_at
    };
}

function toAdminOrderDetail(row) {
    if (!row) return null;

    return {
        ...toAdminOrder(row),
        shippingAddress: normalizeShippingAddress(row.shipping_address),
        notes: row.notes || null,
        source: row.source || null,
        items: (row.items || []).map(toCamelOrderItem)
    };
}

export { toAdminOrder, toAdminOrderDetail };