import React from 'react';
import CreateReturnSearch from './CreateReturnSearch';
import CreateReturnForm from './CreateReturnForm';

// The "Create return" modal. Two steps in one dialog: search → pick an order,
// then review eligibility and submit. Owns no state; the page supplies it all.
export default function CreateReturnModal({
    onClose,
    pickedOrder,
    // search step
    orderSearch,
    onOrderSearchChange,
    orderSearching,
    orderSearchMessage,
    orderResults,
    onSearch,
    onPickOrder,
    eligibilityLoading,
    // eligibility + form step
    eligibility,
    eligibilityError,
    selectedItems,
    onToggleItem,
    onSetItemQuantity,
    reason,
    onReasonChange,
    notes,
    onNotesChange,
    unopened,
    onUnopenedChange,
    creating,
    createError,
    onCreate,
    onBackToSearch,
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
                        onClick={onClose}
                        aria-label="Close create return"
                    >
                        ×
                    </button>
                </div>

                {!pickedOrder ? (
                    <CreateReturnSearch
                        orderSearch={orderSearch}
                        onOrderSearchChange={onOrderSearchChange}
                        orderSearching={orderSearching}
                        orderSearchMessage={orderSearchMessage}
                        orderResults={orderResults}
                        onSearch={onSearch}
                        onPickOrder={onPickOrder}
                        eligibilityLoading={eligibilityLoading}
                    />
                ) : (
                    <CreateReturnForm
                        eligibility={eligibility}
                        eligibilityLoading={eligibilityLoading}
                        eligibilityError={eligibilityError}
                        selectedItems={selectedItems}
                        onToggleItem={onToggleItem}
                        onSetItemQuantity={onSetItemQuantity}
                        reason={reason}
                        onReasonChange={onReasonChange}
                        notes={notes}
                        onNotesChange={onNotesChange}
                        unopened={unopened}
                        onUnopenedChange={onUnopenedChange}
                        creating={creating}
                        createError={createError}
                        onCreate={onCreate}
                        onBackToSearch={onBackToSearch}
                    />
                )}
            </div>
        </div>
    );
}
