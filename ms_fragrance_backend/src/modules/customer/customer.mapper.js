/**
 * customer.mapper.js — maps raw DB rows to the camelCase shapes the frontend
 * consumes, so /api/customer matches the convention already used by the
 * products and auth endpoints.
 */

function toCamelAddress(row) {
    if (!row) return null;

    return {
        id: row.id,
        label: row.label,
        fullName: row.full_name,
        phone: row.phone,
        line1: row.line1,
        line2: row.line2,
        city: row.city,
        state: row.state,
        postalCode: row.postal_code,
        country: row.country,
        isDefault: row.is_default,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function toCamelOrderItem(item) {
    if (!item) return null;

    return {
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        size: item.size,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        lineTotal: item.line_total,
    };
}

function toCamelOrder(row) {
    if (!row) return null;

    return {
        id: row.id,
        orderNumber: row.order_number,
        status: row.status,
        subtotal: row.subtotal,
        shipping: row.shipping,
        total: row.total,
        contactName: row.contact_name,
        contactPhone: row.contact_phone,
        // The stored address snapshot is already camelCase when it was built by
        // the service, but an address saved straight from a DB row is not.
        shippingAddress: normalizeShippingAddress(row.shipping_address),
        notes: row.notes,
        source: row.source,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        items: (row.items || []).map(toCamelOrderItem),
    };
}

// Order snapshots written by the service are already camelCase; fall back to a
// snake_case mapping so either shape is handled safely.
function normalizeShippingAddress(address) {
    if (!address || typeof address !== 'object') return null;

    if (address.fullName !== undefined) return address;

    return {
        fullName: address.full_name,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        postalCode: address.postal_code,
        country: address.country,
    };
}

export { toCamelAddress, toCamelOrder, toCamelOrderItem, normalizeShippingAddress };