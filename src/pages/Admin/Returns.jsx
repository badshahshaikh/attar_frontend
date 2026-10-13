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

import { statusLabel } from './returnsConstants';
import { formatMoney, lineTotalSum } from './returnsFormat';
import ReturnsListHeader from './components/ReturnsListHeader';
import ReturnsToolbar from './components/ReturnsToolbar';
import ReturnsTable from './components/ReturnsTable';
import ReturnsPagination from './components/ReturnsPagination';
import ReturnDetailsModal from './components/ReturnDetailsModal';
import CreateReturnModal from './components/CreateReturnModal';

// Returns admin page. This component owns all data fetching, modal state and
// mutations; presentation is split into the components under ./components and
// the pure helpers in ./returnsConstants + ./returnsFormat.
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
            <ReturnsListHeader
                totalReturns={totalReturns}
                pageMessage={pageMessage}
                onNewReturn={openCreate}
            />

            <ReturnsToolbar
                search={search}
                statusFilter={statusFilter}
                onSearchChange={(value) => {
                    setSearch(value);
                    setPage(1);
                }}
                onStatusChange={(value) => {
                    setStatusFilter(value);
                    setPage(1);
                }}
            />

            {error ? (
                <div className="admin-alert">{error}</div>
            ) : (
                <ReturnsTable
                    loading={loading}
                    returns={returns}
                    onView={handleView}
                />
            )}

            <ReturnsPagination
                pagination={pagination}
                page={page}
                loading={loading}
                setPage={setPage}
            />

            {selectedReturn && (
                <ReturnDetailsModal
                    selectedReturn={selectedReturn}
                    detail={detail}
                    detailLoading={detailLoading}
                    detailError={detailError}
                    onClose={closeView}
                    actionNote={actionNote}
                    onActionNoteChange={setActionNote}
                    actionBusy={actionBusy}
                    onStatusAction={handleStatusAction}
                    onConfirmInspection={handleConfirmInspection}
                    actionError={actionError}
                    actionSuccess={actionSuccess}
                    refundAmount={refundAmount}
                    onRefundAmountChange={setRefundAmount}
                    refundMethod={refundMethod}
                    onRefundMethodChange={setRefundMethod}
                    refundReference={refundReference}
                    onRefundReferenceChange={setRefundReference}
                    refundDate={refundDate}
                    onRefundDateChange={setRefundDate}
                    refundVerified={refundVerified}
                    onRefundVerifiedChange={setRefundVerified}
                    refundBusy={refundBusy}
                    refundError={refundError}
                    refundSuccess={refundSuccess}
                    onRecordRefund={handleRecordRefund}
                />
            )}

            {createOpen && (
                <CreateReturnModal
                    onClose={closeCreate}
                    pickedOrder={pickedOrder}
                    orderSearch={orderSearch}
                    onOrderSearchChange={setOrderSearch}
                    orderSearching={orderSearching}
                    orderSearchMessage={orderSearchMessage}
                    orderResults={orderResults}
                    onSearch={handleOrderSearch}
                    onPickOrder={handlePickOrder}
                    eligibilityLoading={eligibilityLoading}
                    eligibility={eligibility}
                    eligibilityError={eligibilityError}
                    selectedItems={selectedItems}
                    onToggleItem={toggleItem}
                    onSetItemQuantity={setItemQuantity}
                    reason={reason}
                    onReasonChange={setReason}
                    notes={notes}
                    onNotesChange={setNotes}
                    unopened={unopened}
                    onUnopenedChange={setUnopened}
                    creating={creating}
                    createError={createError}
                    onCreate={handleCreate}
                    onBackToSearch={handleBackToSearch}
                />
            )}
        </section>
    );
}

