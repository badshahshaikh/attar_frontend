/**
 * returns.constants.js — Shared return-policy constants.
 *
 * Single source of truth for the admin-managed returns flow: the 7-day
 * eligibility window, the allowed statuses, and the legal state machine.
 * Mirrors the orders.validator.js pattern (ORDER_STATUSES / PAYMENT_STATUSES).
 */

// Returns are accepted within 7 calendar days after delivery.
const RETURN_WINDOW_DAYS = 7;

// Every status a return row may hold (matches the DB CHECK constraint).
const RETURN_STATUSES = [
    'requested',
    'approved',
    'rejected',
    'pickup_pending',
    'received',
    'refund_pending',
    'refunded',
    'closed',
];

// Terminal states: no further transition is possible from these.
const RETURN_TERMINAL_STATUSES = ['refunded', 'closed'];

// Legal transitions. `refunded` is reachable only via the refund endpoint
// (RecordRefundUseCase), never via the status endpoint; `closed` is the
// cleanup state for denied requests. `rejected` stays reopenable so an admin
// can correct a mistaken denial.
const RETURN_TRANSITIONS = {
    requested: ['approved', 'rejected'],
    approved: ['pickup_pending', 'rejected'],
    rejected: ['approved', 'closed'],
    pickup_pending: ['received'],
    received: ['refund_pending'],
    refund_pending: [],
    refunded: [],
    closed: [],
};

// Refund methods recorded for a manual refund (matches the DB CHECK).
const REFUND_METHODS = ['manual', 'upi', 'bank_transfer', 'cash', 'other'];

export {
    RETURN_WINDOW_DAYS,
    RETURN_STATUSES,
    RETURN_TERMINAL_STATUSES,
    RETURN_TRANSITIONS,
    REFUND_METHODS,
};
