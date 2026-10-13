import React from 'react';
import {
    RETURN_TRANSITIONS,
    STATUS_ACTION_LABELS,
    statusLabel,
    canInspect,
} from '../returnsConstants';

// Status-transition buttons + the inspection action. All mutation logic stays
// in the parent; this component only renders and forwards events.
export default function ReturnDetailsActions({
    detail,
    actionNote,
    onActionNoteChange,
    actionBusy,
    onStatusAction,
    onConfirmInspection,
    actionError,
    actionSuccess,
}) {
    return (
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
                            onChange={(event) => onActionNoteChange(event.target.value)}
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
                                onClick={() => onStatusAction(next)}
                            >
                                {actionBusy === 'status'
                                    ? 'Working...'
                                    : STATUS_ACTION_LABELS[next] || `Mark ${statusLabel(next)}`}
                            </button>
                        ))}
                    </div>
                </>
            )}

            {canInspect(detail) && (
                <div className="return-inspection">
                    <p className="muted">
                        Confirming the inspection marks the return as checked and
                        restores the returned units to inventory.
                    </p>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={Boolean(actionBusy)}
                        onClick={onConfirmInspection}
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
    );
}
