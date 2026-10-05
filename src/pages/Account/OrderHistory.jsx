import React, { useEffect, useState } from 'react';
import { fetchOrders } from '../../services/customerService';

const STATUS_LABELS = {
    placed: 'Placed',
    confirmed: 'Confirmed',
    packed: 'Packed',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
};

const formatMoney = (value) =>
    `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const formatDate = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const OrderHistory = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const rows = await fetchOrders();
                if (!cancelled) setOrders(rows);
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) {
        return <p className="account-empty">Loading your orders…</p>;
    }

    return (
        <section className="account-card">
            <div className="account-card-head">
                <h2>Orders</h2>
            </div>

            {error && <div className="auth-error">{error}</div>}

            {!error && orders.length === 0 && (
                <p className="account-empty">
                    No orders yet. Anything you buy will show up here with its tracking status.
                </p>
            )}

            {!error && orders.length > 0 && (
                <ul className="order-list">
                    {orders.map((order) => {
                        const address = order.shippingAddress;
                        const statusKey = String(order.status || '').toLowerCase();
                        const statusLabel = STATUS_LABELS[statusKey] || order.status;

                        return (
                            <li key={order.id} className="order-item">
                                <div className="order-item-head">
                                    <div>
                                        <span className="order-number">{order.orderNumber}</span>
                                        <span className="order-date">{formatDate(order.createdAt)}</span>
                                    </div>
                                    <span className={`order-status order-status--${statusKey}`}>
                                        {statusLabel}
                                    </span>
                                </div>

                                <ul className="order-lines">
                                    {(order.items || []).map((item) => (
                                        <li key={item.id} className="order-line">
                                            <span className="order-line-name">
                                                {item.productName}
                                                {item.size ? <em className="order-line-size">{item.size}</em> : null}
                                            </span>
                                            <span className="order-line-qty">× {item.quantity}</span>
                                            <span className="order-line-total">{formatMoney(item.lineTotal)}</span>
                                        </li>
                                    ))}
                                </ul>

                                <div className="order-totals">
                                    <div className="order-total-row">
                                        <span>Subtotal</span>
                                        <span>{formatMoney(order.subtotal)}</span>
                                    </div>
                                    <div className="order-total-row">
                                        <span>Shipping</span>
                                        <span>{Number(order.shipping) === 0 ? 'FREE' : formatMoney(order.shipping)}</span>
                                    </div>
                                    <div className="order-total-row order-total-row--grand">
                                        <span>Total</span>
                                        <span>{formatMoney(order.total)}</span>
                                    </div>
                                </div>

                                {address && (
                                    <p className="order-address">
                                        <strong>Deliver to:</strong> {address.fullName}, {address.line1}
                                        {address.line2 ? `, ${address.line2}` : null}, {address.city}
                                        {address.state ? `, ${address.state}` : null} {address.postalCode}
                                    </p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};

export default OrderHistory;
