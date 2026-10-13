import React from 'react';
import { formatMoney, formatDateTime, lineTotalSum } from '../returnsFormat';
import { REFUND_METHOD_OPTIONS, refundMethodLabel } from '../returnsConstants';

// Refund section. Two mutually-exclusive branches, exactly as the original:
//   • an existing refund  → read-only summary
//   • status refund_pending → the "record refund" form
export default function ReturnDetailsRefund({
    detail,
    refundAmount,
    onRefundAmountChange,
    refundMethod,
    onRefundMethodChange,
    refundReference,
    onRefundReferenceChange,
    refundDate,
    onRefundDateChange,
    refundVerified,
    onRefundVerifiedChange,
    refundBusy,
    refundError,
    refundSuccess,
    onSubmit,
}) {
    if (detail.refund) {
        return (
            <section className="return-section">
                <h3>Refund</h3>
                <dl className="return-facts">
                    <div>
                        <dt>Amount</dt>
                        <dd>{formatMoney(detail.refund.amount)}</dd>
                    </div>
                    <div>
                        <dt>Method</dt>
                        <dd>{refundMethodLabel(detail.refund.method)}</dd>
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
        );
    }

    if (detail.status !== 'refund_pending') {
        return null;
    }

    return (
        <section className="return-section">
            <h3>Record refund</h3>
            <p className="muted">
                The amount is pre-filled with the full return value
                ({formatMoney(lineTotalSum(detail.items))}); lower amounts are
                allowed for partial refunds. Recording the refund completes
                the return — no further changes will be possible.
            </p>
            <form className="order-form" onSubmit={onSubmit}>
                <div className="return-refund-row">
                    <label className="order-form-field">
                        <span>Amount (₹)</span>
                        <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={refundAmount}
                            onChange={(event) => onRefundAmountChange(event.target.value)}
                            required
                        />
                    </label>
                    <label className="order-form-field">
                        <span>Method</span>
                        <select
                            value={refundMethod}
                            onChange={(event) => onRefundMethodChange(event.target.value)}
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
                            onChange={(event) => onRefundReferenceChange(event.target.value)}
                            placeholder="e.g. UPI txn id"
                        />
                    </label>
                    <label className="order-form-field">
                        <span>Refunded at (optional — defaults to now)</span>
                        <input
                            type="datetime-local"
                            value={refundDate}
                            onChange={(event) => onRefundDateChange(event.target.value)}
                        />
                    </label>
                </div>
                <label className="order-checkbox">
                    <input
                        type="checkbox"
                        checked={refundVerified}
                        onChange={(event) => onRefundVerifiedChange(event.target.checked)}
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
    );
}
