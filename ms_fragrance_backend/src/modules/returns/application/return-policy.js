import { RETURN_WINDOW_DAYS } from '../returns.constants.js';

/**
 * return-policy.js — Shared 7-calendar-day return policy evaluation.
 *
 * Single source of truth used by both the eligibility endpoint (admin UI
 * pre-check) and the create-return transaction (server enforcement), so the
 * banner the admin sees can never disagree with what the server accepts.
 *
 * Window boundary (documented contract): the delivery date is day ONE of the
 * RETURN_WINDOW_DAYS-day window, and elapsed days are counted as UTC calendar
 * days (not rolling 24-hour periods). With delivery on date D the final
 * eligible day is D + 6 (day seven) and the first ineligible day is D + 7.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// Whole calendar days between two instants, measured on UTC calendar dates
// so the window boundary is stable regardless of the server's timezone.
function calendarDaysBetween(from, to) {
    const fromDay = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
    const toDay = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());

    return Math.round((toDay - fromDay) / DAY_MS);
}

/**
 * Evaluate whether an order may be returned right now.
 *
 * @param {Object} params
 * @param {Object} params.order - Order header row (status, delivered_at)
 * @param {Array} params.items - order_items rows
 * @param {Map} params.returnedByItem - order_item_id -> already-returned qty
 * @param {Date} [params.now] - Clock (injectable for tests)
 * @returns {Object} { eligible, reason, deliveredAt, daysAfterDelivery,
 *                     daysRemaining, lines }
 */
export function evaluateEligibility({ order, items = [], returnedByItem = new Map(), now = new Date() }) {
    const lines = (items || []).map((item) => {
        const ordered = Number(item.quantity) || 0;
        const alreadyReturned = Number(returnedByItem.get(Number(item.id)) || 0);
        const returnable = Math.max(0, ordered - alreadyReturned);

        return {
            orderItemId: Number(item.id),
            productId: item.product_id ?? null,
            productName: item.product_name,
            size: item.size || null,
            quantity: ordered,
            unitPrice: item.unit_price,
            lineTotal: item.line_total,
            alreadyReturned,
            returnable,
        };
    });

    const base = { deliveredAt: null, daysAfterDelivery: null, daysRemaining: null, lines };

    if (!order) {
        return { ...base, eligible: false, reason: 'Order not found.' };
    }

    if (order.status !== 'delivered') {
        return { ...base, eligible: false, reason: `Order is "${order.status}", not delivered. Mark it delivered first.` };
    }

    if (!order.delivered_at) {
        return {
            ...base,
            eligible: false,
            reason: 'No delivery date is recorded for this order. Re-mark it delivered to stamp the delivery date.',
        };
    }

    const deliveredAt = new Date(order.delivered_at);
    if (Number.isNaN(deliveredAt.getTime())) {
        return { ...base, eligible: false, reason: 'The recorded delivery date is invalid.' };
    }

    // Absolute-time guard: a delivery stamp in the future is a data error,
    // even when it falls on today's UTC calendar date.
    if (deliveredAt.getTime() > now.getTime()) {
        return {
            ...base,
            deliveredAt: deliveredAt.toISOString(),
            daysAfterDelivery: calendarDaysBetween(deliveredAt, now),
            eligible: false,
            reason: 'The delivery date is in the future. Correct it before creating a return.',
        };
    }

    // The delivery date counts as day one of the window, so a return is
    // accepted while at most RETURN_WINDOW_DAYS - 1 calendar days have
    // elapsed after it: final eligible day = delivery date + 6; the first
    // ineligible day is the delivery date + 7. `daysRemaining` counts the
    // eligible days left including today.
    const daysAfterDelivery = calendarDaysBetween(deliveredAt, now);

    if (daysAfterDelivery >= RETURN_WINDOW_DAYS) {
        return {
            ...base,
            deliveredAt: deliveredAt.toISOString(),
            daysAfterDelivery,
            daysRemaining: 0,
            eligible: false,
            reason: `The 7-day return window closed ${daysAfterDelivery - RETURN_WINDOW_DAYS + 1} day(s) ago (delivered ${daysAfterDelivery} calendar day(s) ago).`,
        };
    }

    if (!lines.some((line) => line.returnable > 0)) {
        return {
            ...base,
            deliveredAt: deliveredAt.toISOString(),
            daysAfterDelivery,
            daysRemaining: RETURN_WINDOW_DAYS - daysAfterDelivery,
            eligible: false,
            reason: 'Every item on this order has already been returned.',
        };
    }

    return {
        ...base,
        deliveredAt: deliveredAt.toISOString(),
        daysAfterDelivery,
        daysRemaining: RETURN_WINDOW_DAYS - daysAfterDelivery,
        eligible: true,
        reason: null,
    };
}
