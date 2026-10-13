import React from 'react';
import ReturnDetailsHeader from './ReturnDetailsHeader';
import ReturnDetailsBadges from './ReturnDetailsBadges';
import ReturnDetailsFacts from './ReturnDetailsFacts';
import ReturnDetailsItems from './ReturnDetailsItems';
import ReturnDetailsActions from './ReturnDetailsActions';
import ReturnDetailsRefund from './ReturnDetailsRefund';
import ReturnDetailsHistory from './ReturnDetailsHistory';

// The full "Return details" modal. Owns no state — it receives the selected
// row, the fetched detail and all the action/refund handlers from the page.
export default function ReturnDetailsModal({
    selectedReturn,
    detail,
    detailLoading,
    detailError,
    onClose,
    // actions
    actionNote,
    onActionNoteChange,
    actionBusy,
    onStatusAction,
    onConfirmInspection,
    actionError,
    actionSuccess,
    // refund form
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
    onRecordRefund,
}) {
    return (
        <div
            className="order-modal-overlay"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                className="order-modal return-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Return details"
            >
                <ReturnDetailsHeader selectedReturn={selectedReturn} onClose={onClose} />

                <ReturnDetailsBadges selectedReturn={selectedReturn} detail={detail} />

                {detailLoading && (
                    <div className="admin-state">Loading return details...</div>
                )}

                {detailError && <div className="admin-alert">{detailError}</div>}

                {!detailLoading && !detailError && detail && (
                    <>
                        <ReturnDetailsFacts detail={detail} />
                        <ReturnDetailsItems detail={detail} />
                        <ReturnDetailsActions
                            detail={detail}
                            actionNote={actionNote}
                            onActionNoteChange={onActionNoteChange}
                            actionBusy={actionBusy}
                            onStatusAction={onStatusAction}
                            onConfirmInspection={onConfirmInspection}
                            actionError={actionError}
                            actionSuccess={actionSuccess}
                        />
                        <ReturnDetailsRefund
                            detail={detail}
                            refundAmount={refundAmount}
                            onRefundAmountChange={onRefundAmountChange}
                            refundMethod={refundMethod}
                            onRefundMethodChange={onRefundMethodChange}
                            refundReference={refundReference}
                            onRefundReferenceChange={onRefundReferenceChange}
                            refundDate={refundDate}
                            onRefundDateChange={onRefundDateChange}
                            refundVerified={refundVerified}
                            onRefundVerifiedChange={onRefundVerifiedChange}
                            refundBusy={refundBusy}
                            refundError={refundError}
                            refundSuccess={refundSuccess}
                            onSubmit={onRecordRefund}
                        />
                        <ReturnDetailsHistory detail={detail} />
                    </>
                )}
            </div>
        </div>
    );
}
