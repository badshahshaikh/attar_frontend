/**
 * return.mapper.js — Maps raw returns rows to the camelCase API shape.
 *
 * Mirrors the orders/order.mapper.js convention: only explicitly selected
 * columns are exposed, and joined admin identity is surfaced as snapshots.
 */

function toReturnItem(row) {
    if (!row) return null;

    return {
        id: row.id,
        orderItemId: row.order_item_id,
        productId: row.product_id ?? null,
        productName: row.product_name,
        size: row.size || null,
        quantity: Number(row.quantity),
        unitPrice: row.unit_price,
        lineTotal: row.line_total,
        orderedQuantity: row.ordered_quantity !== undefined ? Number(row.ordered_quantity) : undefined,
        alreadyReturnedQuantity: row.already_returned_quantity !== undefined
            ? Number(row.already_returned_quantity)
            : undefined,
        stockRestored: row.stock_restored === true,
        restoredAt: row.restored_at || null,
    };
}

function toReturnHistoryEntry(row) {
    if (!row) return null;

    return {
        id: row.id,
        fromStatus: row.from_status || null,
        toStatus: row.to_status,
        changedByAdminName: row.changed_by_admin_name || '',
        note: row.note || null,
        createdAt: row.created_at,
    };
}

function toReturnRefund(row) {
    if (!row) return null;

    return {
        id: row.id,
        amount: row.amount,
        refundedAt: row.refunded_at,
        method: row.method,
        reference: row.reference || null,
        recordedByAdminName: row.recorded_by_admin_name || '',
        createdAt: row.created_at,
    };
}

function toReturn(row) {
    if (!row) return null;

    return {
        id: row.id,
        returnNumber: row.return_number,
        orderId: row.order_id,
        orderNumber: row.order_number || null,
        orderStatus: row.order_status || null,
        orderTotal: row.order_total ?? null,
        status: row.status,
        customerReason: row.customer_reason,
        internalNotes: row.internal_notes || null,
        unopenedConfirmed: row.unopened_confirmed === true,
        inspectedAt: row.inspected_at || null,
        deliveredAt: row.delivered_at_snapshot || row.delivered_at || null,
        daysAfterDelivery: row.days_after_delivery ?? null,
        createdByAdminName: row.created_by_admin_name || '',
        refundAmount: row.refund_amount ?? null,
        refundMethod: row.refund_method || null,
        refundedAt: row.refunded_at || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function toReturnDetail(row) {
    if (!row) return null;

    return {
        ...toReturn(row),
        items: (row.items || []).map(toReturnItem),
        history: (row.history || []).map(toReturnHistoryEntry),
        refund: row.refund ? toReturnRefund(row.refund) : null,
        order: row.orderSnapshot || null,
    };
}

export { toReturn, toReturnDetail, toReturnItem, toReturnHistoryEntry, toReturnRefund };
