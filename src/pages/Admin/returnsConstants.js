// Returns domain constants + pure helpers, extracted from Returns.jsx.
// These mirror the backend source of truth so the UI never lets the admin
// drive a return into a state the server would reject.

export const RETURN_STATUS_LABELS = {
    requested: 'Requested',
    approved: 'Approved',
    rejected: 'Rejected',
    pickup_pending: 'Pickup pending',
    received: 'Received',
    refund_pending: 'Refund pending',
    refunded: 'Refunded',
    closed: 'Closed',
};

export const RETURN_STATUS_OPTIONS = [
    'requested', 'approved', 'rejected', 'pickup_pending',
    'received', 'refund_pending', 'refunded', 'closed',
];

// Legal status transitions — mirrors the backend source of truth
// (ms_fragrance_backend/src/modules/returns/returns.constants.js).
// `refunded` is deliberately absent: only the refund endpoint can produce it.
export const RETURN_TRANSITIONS = {
    requested: ['approved', 'rejected'],
    approved: ['pickup_pending', 'rejected'],
    rejected: ['approved', 'closed'],
    pickup_pending: ['received'],
    received: ['refund_pending'],
    refund_pending: [],
    refunded: [],
    closed: [],
};

export const STATUS_ACTION_LABELS = {
    approved: 'Approve return',
    rejected: 'Reject return',
    pickup_pending: 'Mark for pickup',
    received: 'Mark received',
    refund_pending: 'Mark refund pending',
    closed: 'Close return',
};

// Refund methods allowed by the backend (returns.constants.js REFUND_METHODS).
export const REFUND_METHOD_OPTIONS = [
    { value: 'manual', label: 'Manual' },
    { value: 'upi', label: 'UPI' },
    { value: 'bank_transfer', label: 'Bank transfer' },
    { value: 'cash', label: 'Cash' },
    { value: 'other', label: 'Other' },
];

// Inspection may be confirmed for these statuses only (matches the backend
// inspection gate), and only while the return has not been inspected yet.
export const INSPECTION_STATUSES = ['pickup_pending', 'received', 'refund_pending'];

export const statusLabel = (status) => RETURN_STATUS_LABELS[status] || status;

// Refunded → green, rejected → red, everything else neutral (Orders convention).
export const statusBadgeClass = (status) => {
    if (status === 'refunded') return 'status status-good';
    if (status === 'rejected') return 'status';
    return 'status status-neutral';
};

// Human label for a refund method value, falling back to the raw value.
export const refundMethodLabel = (method) =>
    REFUND_METHOD_OPTIONS.find((option) => option.value === method)?.label || method;

// The inspection action is available only while the return has not been
// inspected yet and sits in one of the INSPECTION_STATUSES.
export const canInspect = (detail) =>
    detail && !detail.inspectedAt && INSPECTION_STATUSES.includes(detail.status);
