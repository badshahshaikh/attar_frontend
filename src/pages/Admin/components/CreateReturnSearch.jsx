import React from 'react';
import { formatDate } from '../returnsFormat';

// Step 1 of the create flow: search for the source order, then pick one.
export default function CreateReturnSearch({
    orderSearch,
    onOrderSearchChange,
    orderSearching,
    orderSearchMessage,
    orderResults,
    onSearch,
    onPickOrder,
    eligibilityLoading,
}) {
    return (
        <>
            <form className="order-form" onSubmit={onSearch}>
                <label className="order-form-field">
                    <span>Search order</span>
                    <input
                        type="text"
                        value={orderSearch}
                        onChange={(event) => onOrderSearchChange(event.target.value)}
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
                                onClick={() => onPickOrder(order)}
                            >
                                Select
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}
