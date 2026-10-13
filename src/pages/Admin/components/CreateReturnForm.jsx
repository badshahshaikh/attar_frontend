import React from 'react';
import { formatMoney, formatDate } from '../returnsFormat';

// Step 2 of the create flow: once an order is picked, show eligibility and
// (when eligible) the item picker + reason form. All state stays in the page.
export default function CreateReturnForm({
    eligibility,
    eligibilityLoading,
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
        <>
            <button
                type="button"
                className="btn btn-secondary return-back"
                onClick={onBackToSearch}
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
                <form className="order-form" onSubmit={onCreate}>
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
                                                onChange={() => onToggleItem(item)}
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
                                                    onSetItemQuantity(item, event.target.value)
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
                            onChange={(event) => onReasonChange(event.target.value)}
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
                            onChange={(event) => onNotesChange(event.target.value)}
                            placeholder="e.g. Customer contacted support on chat"
                        />
                    </label>
                    <label className="order-checkbox">
                        <input
                            type="checkbox"
                            checked={unopened}
                            onChange={(event) => onUnopenedChange(event.target.checked)}
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
    );
}
