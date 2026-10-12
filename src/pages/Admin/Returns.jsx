import React, { useEffect, useState } from 'react';
import {
    fetchReturns,
    fetchReturnDetails,
    checkReturnEligibility,
    createReturn,
    updateReturnStatus,
    confirmReturnInspection,
    recordRefund,
} from '../../services/adminReturnService';
import { fetchOrders } from '../../services/adminOrderService';
import './Returns.css';

const RETURN_STATUS_LABELS = {
    requested: 'Requested',
    approved: 'Approved',
    rejected: 'Rejected',
    pickup_pending: 'Pickup pending',
    received: 'Received',
    refund_pending: 'Refund pending',
    refunded: 'Refunded',
    closed: 'Closed',
};

const RETURN_STATUS_OPTIONS = [
    'requested', 'approved', 'rejected', 'pickup_pending',
    'received', 'refund_pending', 'refunded', 'closed',
];

// Legal status transitions — mirrors the backend source of truth
// (ms_fragrance_backend/src/modules/returns/returns.constants.js).
// `refunded` is deliberately absent: only the refund endpoint can produce it.
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

const STATUS_ACTION_LABELS = {
    approved: 'Approve return',
    rejected: 'Reject return',
    pickup_pending: 'Mark for pickup',
    received: 'Mark received',
    refund_pending: 'Mark refund pending',
    closed: 'Close return',
};

// Refund methods allowed by the backend (returns.constants.js REFUND_METHODS).
const REFUND_METHOD_OPTIONS = [
    { value: 'manual', label: 'Manual' },
    { value: 'upi', label: 'UPI' },
    { value: 'bank_transfer', label: 'Bank transfer' },
    { value: 'cash', label: 'Cash' },
    { value: 'other', label: 'Other' },
];

// Inspection may be confirmed for these statuses only (matches the backend
// inspection gate), and only while the return has not been inspected yet.
const INSPECTION_STATUSES = ['pickup_pending', 'received', 'refund_pending'];

const formatMoney = (value) =>
    `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const formatDate = (iso) => {
    if (!iso) return '-';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (iso) => {
    if (!iso) return '-';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};

const statusLabel = (status) => RETURN_STATUS_LABELS[status] || status;

// Refunded → green, rejected → red, everything else neutral (Orders convention).
const statusBadgeClass = (status) => {
    if (status === 'refunded') return 'status status-good';
    if (status === 'rejected') return 'status';
    return 'status status-neutral';
};

// Ceiling for a refund = sum of the return's own line totals (the backend
// enforces the same bound server-side).
const lineTotalSum = (items = []) =>
    items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);

export default function Returns() {
    // ── List state (mirrors Orders.jsx) ──
    const [data, setData] = useState({ returns: [], pagination: {} });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pageMessage, setPageMessage] = useState('');

    // ── Detail modal state ──
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');

    // ── Status / inspection action state ──
    const [actionNote, setActionNote] = useState('');
    const [actionBusy, setActionBusy] = useState(''); // '' | 'status' | 'inspection'
    const [actionError, setActionError] = useState('');
    const [actionSuccess, setActionSuccess] = useState('');

    // ── Manual refund form state ──
    const [refundAmount, setRefundAmount] = useState('');
    const [refundMethod, setRefundMethod] = useState('manual');
    const [refundReference, setRefundReference] = useState('');
    const [refundDate, setRefundDate] = useState('');
    const [refundVerified, setRefundVerified] = useState(false);
    const [refundBusy, setRefundBusy] = useState(false);
    const [refundError, setRefundError] = useState('');
    const [refundSuccess, setRefundSuccess] = useState('');

    // ── Create-return modal state (order search → eligibility → form) ──
    const [createOpen, setCreateOpen] = useState(false);
    const [orderSearch, setOrderSearch] = useState('');
    const [orderResults, setOrderResults] = useState([]);
    const [orderSearching, setOrderSearching] = useState(false);
    const [orderSearchMessage, setOrderSearchMessage] = useState('');
    const [pickedOrder, setPickedOrder] = useState(null);
    const [eligibility, setEligibility] = useState(null);
    const [eligibilityLoading, setEligibilityLoading] = useState(false);
    const [eligibilityError, setEligibilityError] = useState('');
    const [selectedItems, setSelectedItems] = useState({}); // orderItemId -> qty
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [unopened, setUnopened] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');

        try {
            const result = await fetchReturns({
                page,
                limit: 10,
                search,
                status: statusFilter,
            });

            setData(result);
        } catch (loadError) {
            setError(
                loadError.status === 401
                    ? 'Your session has expired.'
                    : loadError.status === 403
                        ? 'You do not have permission to view returns.'
                        : 'Unable to load returns.'
            );
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, [page, search, statusFilter]);

    const resetActions = () => {
        setActionNote('');
        setActionBusy('');
        setActionError('');
        setActionSuccess('');
    };

    const resetRefundForm = (target) => {
        setRefundAmount(target ? String(lineTotalSum(target.items)) : '');
        setRefundMethod('manual');
        setRefundReference('');
        setRefundDate('');
        setRefundVerified(false);
        setRefundBusy(false);
        setRefundError('');
        setRefundSuccess('');
    };

    const handleView = async (row) => {
        setSelectedReturn(row);
        setDetail(null);
        setDetailError('');
        setDetailLoading(true);
        resetActions();
        resetRefundForm(null);

        try {
            const result = await fetchReturnDetails(row.id);
            setDetail(result.return);
            resetRefundForm(result.return);
        } catch (loadError) {
            setDetailError(
                loadError.status === 404
                    ? 'Return not found.'
                    : loadError.status === 403
                        ? 'You do not have permission to view returns.'
                        : 'Unable to load return details.'
            );
        } finally {
            setDetailLoading(false);
        }
    };

    const closeView = () => {
        setSelectedReturn(null);
        setDetail(null);
        setDetailError('');
        resetActions();
        resetRefundForm(null);
    };

    // Persist the server's fresh detail into the modal and sync the list row,
    // so the UI never shows a state the backend did not confirm.
    const applyDetail = (result) => {
        const updated = result.return;
        setDetail(updated);
        // The header opens from the list row; refresh it with the confirmed
        // detail so the status badge updates immediately after a mutation.
        setSelectedReturn((prev) =>
            prev && prev.id === updated.id
                ? { ...prev, status: updated.status, inspectedAt: updated.inspectedAt }
                : prev
        );
        setData((prev) => ({
            ...prev,
            returns: (prev.returns || []).map((row) =>
                row.id === updated.id
                    ? {
                        ...row,
                        status: updated.status,
                        refundAmount: updated.refundAmount,
                        refundMethod: updated.refundMethod,
                        refundedAt: updated.refundedAt,
                        inspectedAt: updated.inspectedAt,
                        updatedAt: updated.updatedAt,
                    }
                    : row
            ),
        }));
    };

    // Mirror of the backend rejection rule: a note is mandatory there, so the
    // form collects it first instead of surfacing a 422 after submit.
    const handleStatusAction = async (nextStatus) => {
        if (actionBusy || !detail) return;

        const note = actionNote.trim();
        if (nextStatus === 'rejected' && !note) {
            setActionSuccess('');
            setActionError('A reason is required when rejecting a return.');
            return;
        }

        setActionBusy('status');
        setActionError('');
        setActionSuccess('');

        try {
            const result = await updateReturnStatus(detail.id, {
                status: nextStatus,
                note,
            });
            applyDetail(result);
            setActionNote('');
            setActionSuccess(`Status updated to ${statusLabel(nextStatus)}.`);
        } catch (saveError) {
            setActionError(
                saveError.status === 403
                    ? 'You do not have permission to update returns.'
                    : saveError.status === 409
                        ? 'This return changed elsewhere. Close it and reopen to see the latest state.'
                        : saveError.message || 'Unable to update the status. Please try again.'
            );
        } finally {
            setActionBusy('');
        }
    };

    const canInspect =
        detail &&
        !detail.inspectedAt &&
        INSPECTION_STATUSES.includes(detail.status);

    // Stock is only restored by a same-status PATCH with inspected: true —
    // the backend inspection gate. This is the only UI path that sends it.
    const handleConfirmInspection = async () => {
        if (actionBusy || !detail) return;

        setActionBusy('inspection');
        setActionError('');
        setActionSuccess('');

        try {
            const result = await confirmReturnInspection(detail.id, detail.status);
            applyDetail(result);
            const restoredCount = Array.isArray(result.return.stockRestored)
                ? result.return.stockRestored.length
                : 0;
            setActionSuccess(
                restoredCount > 0
                    ? `Inspection confirmed. Stock restored for ${restoredCount} line${restoredCount === 1 ? '' : 's'}.`
                    : 'Inspection confirmed.'
            );
        } catch (saveError) {
            setActionError(
                saveError.status === 403
                    ? 'You do not have permission to update returns.'
                    : saveError.status === 409
                        ? 'This return changed elsewhere. Close it and reopen to see the latest state.'
                        : saveError.message || 'Unable to confirm the inspection. Please try again.'
            );
        } finally {
            setActionBusy('');
        }
    };

    const handleRecordRefund = async (event) => {
        event.preventDefault();
        if (refundBusy || !detail) return;

        if (!refundVerified) {
            setRefundSuccess('');
            setRefundError('Confirm that this refund has been verified before recording it.');
            return;
        }

        const amount = Number(refundAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            setRefundSuccess('');
            setRefundError('Enter a valid refund amount.');
            return;
        }

        const payload = { amount, method: refundMethod };
        if (refundReference.trim()) payload.reference = refundReference.trim();
        if (refundDate) {
            const when = new Date(refundDate);
            if (Number.isNaN(when.getTime())) {
                setRefundSuccess('');
                setRefundError('Enter a valid refund date and time.');
                return;
            }
            payload.refundedAt = when.toISOString();
        }

        setRefundBusy(true);
        setRefundError('');
        setRefundSuccess('');

        try {
            const result = await recordRefund(detail.id, payload);
            applyDetail(result);
            setRefundSuccess(
                `Refund of ${formatMoney(result.return.refundAmount ?? amount)} recorded.`
            );
        } catch (saveError) {
            setRefundError(
                saveError.status === 403
                    ? 'You do not have permission to record refunds.'
                    : saveError.status === 409
                        ? 'This return changed elsewhere. Close it and reopen to see the latest state.'
                        : saveError.message || 'Unable to record the refund. Please try again.'
            );
        } finally {
            setRefundBusy(false);
        }
    };

    // ── Create-return flow handlers ──
    const openCreate = () => {
        setCreateOpen(true);
        setPageMessage('');
        setOrderSearch('');
        setOrderResults([]);
        setOrderSearching(false);
        setOrderSearchMessage('');
        setPickedOrder(null);
        setEligibility(null);
        setEligibilityLoading(false);
        setEligibilityError('');
        setSelectedItems({});
        setReason('');
        setNotes('');
        setUnopened(false);
        setCreateError('');
    };

    const closeCreate = () => {
        if (creating) return;
        setCreateOpen(false);
    };

    // The create flow starts from a real order: the backend derives items,
    // prices and the customer from the order row, so we look orders up first.
    const handleOrderSearch = async (event) => {
        event.preventDefault();
        const query = orderSearch.trim();
        if (!query || orderSearching) return;

        setOrderSearching(true);
        setOrderSearchMessage('');
        setOrderResults([]);

        try {
            const result = await fetchOrders({ page: 1, limit: 5, search: query });
            const orders = result.orders || [];
            setOrderResults(orders);
            if (!orders.length) setOrderSearchMessage('No orders matched your search.');
        } catch (searchError) {
            setOrderSearchMessage(
                searchError.status === 403
                    ? 'You do not have permission to search orders.'
                    : 'Unable to search orders. Please try again.'
            );
        } finally {
            setOrderSearching(false);
        }
    };

    const handlePickOrder = async (order) => {
        if (eligibilityLoading) return;

        setPickedOrder(order);
        setEligibility(null);
        setEligibilityError('');
        setSelectedItems({});
        setCreateError('');
        setEligibilityLoading(true);

        try {
            setEligibility(await checkReturnEligibility(order.id));
        } catch (checkError) {
            setEligibilityError(
                checkError.status === 404
                    ? 'Order not found.'
                    : checkError.status === 403
                        ? 'You do not have permission to check return eligibility.'
                        : 'Unable to check return eligibility. Please try again.'
            );
        } finally {
            setEligibilityLoading(false);
        }
    };

    const handleBackToSearch = () => {
        if (eligibilityLoading) return;
        setPickedOrder(null);
        setEligibility(null);
        setEligibilityError('');
        setSelectedItems({});
        setCreateError('');
    };

    const toggleItem = (item) => {
        setSelectedItems((prev) => {
            const next = { ...prev };
            if (next[item.id]) delete next[item.id];
            else next[item.id] = 1;
            return next;
        });
    };

    const setItemQuantity = (item, raw) => {
        const max = Number(item.returnable) || 1;
        let qty = Number.parseInt(raw, 10);
        if (Number.isNaN(qty)) qty = 1;
        if (qty < 1) qty = 1;
        if (qty > max) qty = max; // never allow more than what is returnable
        setSelectedItems((prev) => ({ ...prev, [item.id]: qty }));
    };

    const handleCreate = async (event) => {
        event.preventDefault();
        if (creating || !eligibility || !pickedOrder || !eligibility.eligible) return;

        const items = Object.entries(selectedItems)
            .map(([orderItemId, quantity]) => ({
                orderItemId: Number(orderItemId),
                quantity: Number(quantity),
            }))
            .filter((line) => Number.isFinite(line.orderItemId) && line.quantity > 0);

        if (!items.length) {
            setCreateError('Select at least one item and quantity to return.');
            return;
        }
        if (!reason.trim()) {
            setCreateError('Enter the reason for the return.');
            return;
        }
        if (!unopened) {
            setCreateError('Confirm that the returned products are unopened.');
            return;
        }

        setCreating(true);
        setCreateError('');

        try {
            const result = await createReturn({
                orderId: pickedOrder.id,
                items,
                customerReason: reason.trim(),
                internalNotes: notes.trim(),
                unopenedConfirmed: unopened,
            });

            setCreateOpen(false);
            setPageMessage(
                `Return ${result.return.returnNumber} created for order #${result.return.orderNumber || pickedOrder.orderNumber}.`
            );
            await load();
            handleView(result.return);
        } catch (saveError) {
            setCreateError(
                saveError.status === 403
                    ? 'You do not have permission to create returns.'
                    : saveError.status === 409
                        ? 'The order changed while you were working on it. Pick it again and retry.'
                        : saveError.message || 'Unable to create the return. Please try again.'
            );
        } finally {
            setCreating(false);
        }
    };

    const pagination = data.pagination || {};
    const returns = data.returns || [];
    const totalReturns = pagination.totalReturns ?? returns.length;

    return (
        <section className="admin-page">
            <div className="admin-page-header">
                <div>
                    <p className="admin-page-eyebrow">Sales</p>
                    <h2>Returns</h2>
                    <p>{totalReturns} customer return{totalReturns === 1 ? '' : 's'}</p>
                </div>
                <div className="admin-page-actions">
                    <button type="button" className="btn btn-primary" onClick={openCreate}>
                        New Return
                    </button>
                </div>
            </div>

            {pageMessage && <div className="admin-message">{pageMessage}</div>}

            <div className="admin-toolbar">
                <input
                    type="text"
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                    }}
                    placeholder="Search returns..."
                />
                <select
                    value={statusFilter}
                    onChange={(event) => {
                        setStatusFilter(event.target.value);
                        setPage(1);
                    }}
                    className="admin-select"
                >
                    <option value="">All statuses</option>
                    {RETURN_STATUS_OPTIONS.map((value) => (
                        <option key={value} value={value}>{statusLabel(value)}</option>
                    ))}
                </select>
            </div>

            {error ? (
                <div className="admin-alert">{error}</div>
            ) : (
                <div className="admin-table-wrap">
                    {loading ? (
                        <div className="admin-state">Loading returns...</div>
                    ) : returns.length === 0 ? (
                        <div className="admin-state">No returns found.</div>
                    ) : (
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Return</th>
                                    <th>Order</th>
                                    <th>Created</th>
                                    <th>Status</th>
                                    <th>Refund</th>
                                    <th aria-label="Actions" />
                                </tr>
                            </thead>
                            <tbody>
                                {returns.map((row) => (
                                    <tr key={row.id}>
                                        <td>
                                            <div className="admin-user-cell">
                                                <strong>{row.returnNumber}</strong>
                                                {row.inspectedAt && (
                                                    <span className="muted">Inspected {formatDate(row.inspectedAt)}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td><strong>#{row.orderNumber}</strong></td>
                                        <td>{formatDate(row.createdAt)}</td>
                                        <td>
                                            <span className={statusBadgeClass(row.status)}>
                                                {statusLabel(row.status)}
                                            </span>
                                        </td>
                                        <td>
                                            {row.refundAmount != null ? (
                                                <span className="status status-good">{formatMoney(row.refundAmount)}</span>
                                            ) : row.status === 'refund_pending' ? (
                                                <span className="status status-neutral">Pending</span>
                                            ) : (
                                                '-'
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                onClick={() => handleView(row)}
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {pagination.totalPages > 1 && (
                <div className="admin-pagination">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={!pagination.hasPreviousPage || loading}
                        onClick={() => setPage((value) => Math.max(1, value - 1))}
                    >
                        Previous
                    </button>
                    <span>Page {pagination.page || page} of {pagination.totalPages}</span>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={!pagination.hasNextPage || loading}
                        onClick={() => setPage((value) => value + 1)}
                    >
                        Next
                    </button>
                </div>
            )}

            {selectedReturn && (
                <div
                    className="order-modal-overlay"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) closeView();
                    }}
                >
                    <div
                        className="order-modal return-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Return details"
                    >
                        <div className="order-modal-header">
                            <div>
                                <p className="admin-page-eyebrow">Return details</p>
                                <h2>{selectedReturn.returnNumber}</h2>
                                <p className="muted">Order #{selectedReturn.orderNumber}</p>
                            </div>
                            <button
                                type="button"
                                className="order-modal-close"
                                onClick={closeView}
                                aria-label="Close return details"
                            >
                                ×
                            </button>
                        </div>

                        <div className="return-badges">
                            <span className={statusBadgeClass(selectedReturn.status)}>
                                {statusLabel(selectedReturn.status)}
                            </span>
                            {detail && detail.refundAmount != null && (
                                <span className="status status-good">
                                    Refunded {formatMoney(detail.refundAmount)}
                                </span>
                            )}
                            {detail && detail.inspectedAt && (
                                <span className="status status-neutral">
                                    Inspected {formatDateTime(detail.inspectedAt)}
                                </span>
                            )}
                        </div>

                        {detailLoading && (
                            <div className="admin-state">Loading return details...</div>
                        )}

                        {detailError && <div className="admin-alert">{detailError}</div>}

                        {!detailLoading && !detailError && detail && (
                            <>
                                <div className="return-modal-grid">
                                    <section className="return-section">
                                        <h3>Original order</h3>
                                        <dl className="return-facts">
                                            <div>
                                                <dt>Order status</dt>
                                                <dd>{detail.order?.status || '-'}</dd>
                                            </div>
                                            <div>
                                                <dt>Payment</dt>
                                                <dd>{detail.order?.paymentStatus || '-'}</dd>
                                            </div>
                                            <div>
                                                <dt>Order total</dt>
                                                <dd>{formatMoney(detail.order?.total)}</dd>
                                            </div>
                                            <div>
                                                <dt>Customer</dt>
                                                <dd>{detail.order?.customerName || '-'}</dd>
                                            </div>
                                            <div>
                                                <dt>Phone</dt>
                                                <dd>{detail.order?.customerPhone || '-'}</dd>
                                            </div>
                                            <div>
                                                <dt>Delivered</dt>
                                                <dd>{formatDate(detail.deliveredAt)}</dd>
                                            </div>
                                        </dl>
                                    </section>

                                    <section className="return-section">
                                        <h3>Return</h3>
                                        <dl className="return-facts">
                                            <div>
                                                <dt>Created</dt>
                                                <dd>{formatDateTime(detail.createdAt)}</dd>
                                            </div>
                                            <div>
                                                <dt>By</dt>
                                                <dd>{detail.createdByAdminName || 'System'}</dd>
                                            </div>
                                            <div>
                                                <dt>Days after delivery</dt>
                                                <dd>{detail.daysAfterDelivery ?? '-'}</dd>
                                            </div>
                                            <div>
                                                <dt>Unopened confirmed</dt>
                                                <dd>{detail.unopenedConfirmed ? 'Yes' : 'No'}</dd>
                                            </div>
                                            <div>
                                                <dt>Inspected</dt>
                                                <dd>{detail.inspectedAt ? formatDateTime(detail.inspectedAt) : 'Not yet'}</dd>
                                            </div>
                                            <div>
                                                <dt>Last updated</dt>
                                                <dd>{formatDateTime(detail.updatedAt)}</dd>
                                            </div>
                                        </dl>
                                    </section>
                                </div>

                                <section className="return-section">
                                    <h3>Returned items</h3>
                                    <div className="order-items-wrap">
                                        <table className="order-items">
                                            <thead>
                                                <tr>
                                                    <th>Product</th>
                                                    <th>Qty</th>
                                                    <th>Ordered</th>
                                                    <th>Unit price</th>
                                                    <th>Line total</th>
                                                    <th>Stock</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(detail.items || []).map((item) => (
                                                    <tr key={item.id}>
                                                        <td>
                                                            <strong>{item.productName}</strong>
                                                            <span className="muted">{item.size || '-'}</span>
                                                        </td>
                                                        <td>{item.quantity}</td>
                                                        <td>{item.orderedQuantity ?? '-'}</td>
                                                        <td>{formatMoney(item.unitPrice)}</td>
                                                        <td>{formatMoney(item.lineTotal)}</td>
                                                        <td>
                                                            {item.stockRestored
                                                                ? `Restored ${formatDate(item.restoredAt)}`
                                                                : 'Not restored'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>

                                <section className="return-section">
                                    <h3>Customer reason</h3>
                                    <p>{detail.customerReason || '-'}</p>
                                    {detail.internalNotes && (
                                        <>
                                            <h3>Internal notes</h3>
                                            <p>{detail.internalNotes}</p>
                                        </>
                                    )}
                                </section>

                                <section className="return-section">
                                    <h3>Actions</h3>
                                    {(RETURN_TRANSITIONS[detail.status] || []).length === 0 ? (
                                        <p className="muted">
                                            {detail.status === 'refunded'
                                                ? 'This return is refunded. No further status changes are possible.'
                                                : detail.status === 'refund_pending'
                                                    ? 'Record the refund below to complete this return.'
                                                    : 'No further status changes are possible.'}
                                        </p>
                                    ) : (
                                        <>
                                            <label className="order-form-field">
                                                <span>Note (optional — required when rejecting)</span>
                                                <input
                                                    type="text"
                                                    value={actionNote}
                                                    onChange={(event) => setActionNote(event.target.value)}
                                                    placeholder="e.g. Wrong size delivered"
                                                />
                                            </label>
                                            <div className="return-actions">
                                                {(RETURN_TRANSITIONS[detail.status] || []).map((next) => (
                                                    <button
                                                        key={next}
                                                        type="button"
                                                        className={next === 'rejected' ? 'btn' : 'btn btn-secondary'}
                                                        disabled={Boolean(actionBusy)}
                                                        onClick={() => handleStatusAction(next)}
                                                    >
                                                        {actionBusy === 'status'
                                                            ? 'Working...'
                                                            : STATUS_ACTION_LABELS[next] || `Mark ${statusLabel(next)}`}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {canInspect && (
                                        <div className="return-inspection">
                                            <p className="muted">
                                                Confirming the inspection marks the return as checked and
                                                restores the returned units to inventory.
                                            </p>
                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                disabled={Boolean(actionBusy)}
                                                onClick={handleConfirmInspection}
                                            >
                                                {actionBusy === 'inspection'
                                                    ? 'Confirming...'
                                                    : 'Confirm inspection & restore stock'}
                                            </button>
                                        </div>
                                    )}

                                    {actionError && <p className="admin-alert">{actionError}</p>}
                                    {actionSuccess && <p className="admin-message">{actionSuccess}</p>}
                                </section>

                                {detail.refund ? (
                                    <section className="return-section">
                                        <h3>Refund</h3>
                                        <dl className="return-facts">
                                            <div>
                                                <dt>Amount</dt>
                                                <dd>{formatMoney(detail.refund.amount)}</dd>
                                            </div>
                                            <div>
                                                <dt>Method</dt>
                                                <dd>
                                                    {REFUND_METHOD_OPTIONS.find(
                                                        (option) => option.value === detail.refund.method
                                                    )?.label || detail.refund.method}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt>Reference</dt>
                                                <dd>{detail.refund.reference || '-'}</dd>
                                            </div>
                                            <div>
                                                <dt>Refunded at</dt>
                                                <dd>{formatDateTime(detail.refund.refundedAt)}</dd>
                                            </div>
                                            <div>
                                                <dt>Recorded by</dt>
                                                <dd>{detail.refund.recordedByAdminName || '-'}</dd>
                                            </div>
                                        </dl>
                                        {refundSuccess && <p className="admin-message">{refundSuccess}</p>}
                                    </section>
                                ) : detail.status === 'refund_pending' ? (
                                    <section className="return-section">
                                        <h3>Record refund</h3>
                                        <p className="muted">
                                            The amount is pre-filled with the full return value
                                            ({formatMoney(lineTotalSum(detail.items))}); lower amounts are
                                            allowed for partial refunds. Recording the refund completes
                                            the return — no further changes will be possible.
                                        </p>
                                        <form className="order-form" onSubmit={handleRecordRefund}>
                                            <div className="return-refund-row">
                                                <label className="order-form-field">
                                                    <span>Amount (₹)</span>
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        value={refundAmount}
                                                        onChange={(event) => setRefundAmount(event.target.value)}
                                                        required
                                                    />
                                                </label>
                                                <label className="order-form-field">
                                                    <span>Method</span>
                                                    <select
                                                        value={refundMethod}
                                                        onChange={(event) => setRefundMethod(event.target.value)}
                                                    >
                                                        {REFUND_METHOD_OPTIONS.map((option) => (
                                                            <option key={option.value} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                            </div>

                                            <div className="return-refund-row">
                                                <label className="order-form-field">
                                                    <span>Reference (optional)</span>
                                                    <input
                                                        type="text"
                                                        value={refundReference}
                                                        onChange={(event) => setRefundReference(event.target.value)}
                                                        placeholder="e.g. UPI txn id"
                                                    />
                                                </label>
                                                <label className="order-form-field">
                                                    <span>Refunded at (optional — defaults to now)</span>
                                                    <input
                                                        type="datetime-local"
                                                        value={refundDate}
                                                        onChange={(event) => setRefundDate(event.target.value)}
                                                    />
                                                </label>
                                            </div>
                                            <label className="order-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={refundVerified}
                                                    onChange={(event) => setRefundVerified(event.target.checked)}
                                                />
                                                <span>
                                                    I have verified this refund has been sent to the customer
                                                </span>
                                            </label>
                                            {refundError && <p className="admin-alert">{refundError}</p>}
                                            {refundSuccess && <p className="admin-message">{refundSuccess}</p>}
                                            <div className="order-form-actions">
                                                <button
                                                    type="submit"
                                                    className="btn btn-primary"
                                                    disabled={refundBusy}
                                                >
                                                    {refundBusy ? 'Recording...' : 'Record Refund'}
                                                </button>
                                            </div>
                                        </form>
                                    </section>
                                ) : null}

                                {(detail.history || []).length > 0 && (
                                    <section className="return-section">
                                        <h3>History</h3>
                                        <ul className="return-history">
                                            {detail.history.map((entry) => (
                                                <li key={entry.id}>
                                                    <span className="return-history-status">
                                                        {entry.fromStatus
                                                            ? `${statusLabel(entry.fromStatus)} → ${statusLabel(entry.toStatus)}`
                                                            : statusLabel(entry.toStatus)}
                                                    </span>
                                                    <span className="muted">
                                                        {formatDateTime(entry.createdAt)}
                                                        {entry.changedByAdminName
                                                            ? ` · ${entry.changedByAdminName}`
                                                            : ''}
                                                    </span>
                                                    {entry.note && <p>{entry.note}</p>}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {createOpen && (
                <div
                    className="order-modal-overlay"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) closeCreate();
                    }}
                >
                    <div
                        className="order-modal return-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Create return"
                    >
                        <div className="order-modal-header">
                            <div>
                                <p className="admin-page-eyebrow">New return</p>
                                <h2>Create return</h2>
                                <p className="muted">
                                    {pickedOrder
                                        ? `Order #${pickedOrder.orderNumber}`
                                        : 'Start by finding the order the customer wants to return from.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="order-modal-close"
                                onClick={closeCreate}
                                aria-label="Close create return"
                            >
                                ×
                            </button>
                        </div>

                        {!pickedOrder && (
                            <>
                                <form className="order-form" onSubmit={handleOrderSearch}>
                                    <label className="order-form-field">
                                        <span>Search order</span>
                                        <input
                                            type="text"
                                            value={orderSearch}
                                            onChange={(event) => setOrderSearch(event.target.value)}
                                            placeholder="Order number, email or phone"
                                        />
                                    </label>
                                    <div className="order-form-actions">
                                        <button
                                            type="submit"
                                            className="btn btn-primary"
                                            disabled={orderSearching || !orderSearch.trim()}
                                        >
                                            {orderSearching ? 'Searching...' : 'Search Orders'}
                                        </button>
                                    </div>
                                </form>

                                {orderSearchMessage && <p className="admin-alert">{orderSearchMessage}</p>}

                                {orderResults.length > 0 && (
                                    <ul className="return-order-results">
                                        {orderResults.map((order) => (
                                            <li key={order.id}>
                                                <div>
                                                    <strong>#{order.orderNumber}</strong>
                                                    <span className="muted">
                                                        {order.customerName || order.customerEmail || '-'} ·{' '}
                                                        {formatDate(order.orderDate)}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    disabled={eligibilityLoading}
                                                    onClick={() => handlePickOrder(order)}
                                                >
                                                    Select
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        )}

                        {pickedOrder && (
                            <>
                                <button
                                    type="button"
                                    className="btn btn-secondary return-back"
                                    onClick={handleBackToSearch}
                                    disabled={eligibilityLoading}
                                >
                                    ← Choose another order
                                </button>

                                {eligibilityLoading && (
                                    <div className="admin-state">Checking eligibility...</div>
                                )}

                                {eligibilityError && <div className="admin-alert">{eligibilityError}</div>}

                                {eligibility && !eligibility.eligible && (
                                    <div className="admin-alert">
                                        This order cannot be returned: {eligibility.reason || 'not eligible'}.
                                    </div>
                                )}

                                {eligibility && eligibility.eligible && (
                                    <form className="order-form" onSubmit={handleCreate}>
                                        <p className="muted">
                                            Delivered {formatDate(eligibility.deliveredAt)} ·{' '}
                                            {eligibility.daysAfterDelivery} day
                                            {eligibility.daysAfterDelivery === 1 ? '' : 's'} after delivery ·{' '}
                                            {eligibility.daysRemaining} day
                                            {eligibility.daysRemaining === 1 ? '' : 's'} left in the window
                                        </p>

                                        <div className="return-section">
                                            <h3>Items</h3>
                                            <ul className="return-item-picker">
                                                {eligibility.items.map((item) => {
                                                    const returnable = Number(item.returnable) > 0;
                                                    const checked = Boolean(selectedItems[item.id]);
                                                    return (
                                                        <li key={item.id}>
                                                            <label className={returnable ? '' : 'return-item-disabled'}>
                                                                <input
                                                                    type="checkbox"
                                                                    disabled={!returnable}
                                                                    checked={checked}
                                                                    onChange={() => toggleItem(item)}
                                                                />
                                                                <span>
                                                                    <strong>{item.productName}</strong>
                                                                    <span className="muted">
                                                                        {item.size || '-'} · {formatMoney(item.unitPrice)} ·{' '}
                                                                        {returnable
                                                                            ? `${item.returnable} of ${item.quantity} returnable`
                                                                            : `fully returned (${item.quantity})`}
                                                                    </span>
                                                                </span>
                                                            </label>
                                                            {checked && (
                                                                <input
                                                                    type="number"
                                                                    className="return-qty"
                                                                    min="1"
                                                                    max={item.returnable}
                                                                    value={selectedItems[item.id]}
                                                                    onChange={(event) =>
                                                                        setItemQuantity(item, event.target.value)
                                                                    }
                                                                    aria-label={`Quantity of ${item.productName} to return`}
                                                                />
                                                            )}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>

                                        <label className="order-form-field">
                                            <span>Reason</span>
                                            <input
                                                type="text"
                                                value={reason}
                                                onChange={(event) => setReason(event.target.value)}
                                                placeholder="e.g. Customer changed their mind"
                                                maxLength={1000}
                                                required
                                            />
                                        </label>
                                        <label className="order-form-field">
                                            <span>Internal notes (optional)</span>
                                            <input
                                                type="text"
                                                value={notes}
                                                onChange={(event) => setNotes(event.target.value)}
                                                placeholder="e.g. Customer contacted support on chat"
                                            />
                                        </label>
                                        <label className="order-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={unopened}
                                                onChange={(event) => setUnopened(event.target.checked)}
                                            />
                                            <span>
                                                The customer confirms the products are unopened and sealed
                                            </span>
                                        </label>

                                        {createError && <p className="admin-alert">{createError}</p>}

                                        <div className="order-form-actions">
                                            <button
                                                type="submit"
                                                className="btn btn-primary"
                                                disabled={creating}
                                            >
                                                {creating ? 'Creating...' : 'Create Return'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}













