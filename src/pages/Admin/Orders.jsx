import React, { useEffect, useState } from 'react';
import { fetchOrders, fetchOrderDetails } from '../../services/adminOrderService';
import './Orders.css';

const STATUS_LABELS = {
    placed: 'Placed',
    confirmed: 'Confirmed',
    packed: 'Packed',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    paid: 'Paid',
};

const ORDER_STATUS_OPTIONS = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const PAYMENT_STATUS_OPTIONS = ['unpaid', 'paid'];

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

const statusLabel = (status) => STATUS_LABELS[status] || status;

// Delivered → green, cancelled → red, anything in progress → neutral.
const statusBadgeClass = (status) => {
    if (status === 'delivered') return 'status status-good';
    if (status === 'cancelled') return 'status';
    return 'status status-neutral';
};

const paymentBadgeClass = (paymentStatus) =>
    paymentStatus === 'paid' ? 'status status-good' : 'status';

const paymentLabel = (paymentStatus) => {
    if (paymentStatus === 'paid') return 'Paid';
    if (paymentStatus === 'unpaid') return 'Unpaid';
    if (!paymentStatus) return 'Unknown';

    return paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1);
};

export default function Orders() {
        const [data, setData] = useState({ orders: [], pagination: {} });
        const [search, setSearch] = useState('');
        const [statusFilter, setStatusFilter] = useState('');
        const [paymentFilter, setPaymentFilter] = useState('');
        const [page, setPage] = useState(1);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState('');

        // View action state
        const [selectedOrder, setSelectedOrder] = useState(null);
        const [detail, setDetail] = useState(null);
        const [detailLoading, setDetailLoading] = useState(false);
        const [detailError, setDetailError] = useState('');

        const load = async () => {
            setLoading(true);
            setError('');

            try {
                const result = await fetchOrders({
                    page,
                    limit: 10,
                    search,
                    status: statusFilter,
                    paymentStatus: paymentFilter,
                });

                setData(result);
            } catch (loadError) {
                setError(
                    loadError.status === 401
                        ? 'Your session has expired.'
                        : loadError.status === 403
                            ? 'You do not have permission to view orders.'
                            : 'Unable to load orders.'
                );
            } finally {
                setLoading(false);
            }
        };
        useEffect(() => { load(); }, [page, search, statusFilter, paymentFilter]);

        const handleView = async (order) => {
            setSelectedOrder(order);
            setDetail(null);
            setDetailError('');
            setDetailLoading(true);

            try {
                const result = await fetchOrderDetails(order.id);
                setDetail(result.order);
            } catch (loadError) {
                setDetailError(
                    loadError.status === 404
                        ? 'Order not found.'
                        : 'Unable to load order details.'
                );
            } finally {
                setDetailLoading(false);
            }
        };

        const closeView = () => {
            setSelectedOrder(null);
            setDetail(null);
            setDetailError('');
        };

        const pagination = data.pagination || {};

        return (
            <section className="admin-page">
                <div className="admin-page-heading">
                    <div>
                        <p className="admin-eyebrow">Sales</p>
                        <h1>Orders</h1>
                        <p>{pagination.totalOrders ?? data.orders.length} customer orders.</p>
                    </div>
                </div>
                <div className="admin-toolbar">
                    <div className="admin-search">
                        <label htmlFor="order-search">Search orders</label>
                        <input
                            id="order-search"
                            type="search"
                            value={search}
                            onChange={event => {
                                setPage(1);
                                setSearch(event.target.value);
                            }}
                            placeholder="Search by order number, name, email or phone..."
                        />
                    </div>
                    <div className="order-filter">
                        <label htmlFor="order-status-filter">Status</label>
                        <select
                            id="order-status-filter"
                            value={statusFilter}
                            onChange={event => {
                                setPage(1);
                                setStatusFilter(event.target.value);
                            }}
                        >
                            <option value="">All statuses</option>
                            {ORDER_STATUS_OPTIONS.map(status => (
                                <option key={status} value={status}>{statusLabel(status)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="order-filter">
                        <label htmlFor="order-payment-filter">Payment</label>
                        <select
                            id="order-payment-filter"
                            value={paymentFilter}
                            onChange={event => {
                                setPage(1);
                                setPaymentFilter(event.target.value);
                            }}
                        >
                            <option value="">All payments</option>
                            {PAYMENT_STATUS_OPTIONS.map(payment => (
                                <option key={payment} value={payment}>{paymentLabel(payment)}</option>
                            ))}
                        </select>
                    </div>
                </div>
                {loading ? (
                <div className="admin-state">Loading orders...</div>
            ) : data.orders.length ? (
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Order #</th>
                                <th>Customer</th>
                                <th>Contact</th>
                                <th>Date</th>
                                <th>Total</th>
                                <th>Payment</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.orders.map(order => (
                                <tr key={order.id}>
                                    <td><strong>#{order.orderNumber}</strong></td>
                                    <td>
                                        <div className="order-customer">
                                            <strong>{order.customerName || '-'}</strong>
                                            {order.customerEmail && <span>{order.customerEmail}</span>}
                                        </div>
                                    </td>
                                    <td>{order.customerPhone || order.contactPhone || '-'}</td>
                                    <td>{formatDate(order.orderDate)}</td>
                                    <td>{formatMoney(order.total)}</td>
                                    <td>
                                        <span className={paymentBadgeClass(order.paymentStatus)}>
                                            {paymentLabel(order.paymentStatus)}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={statusBadgeClass(order.status)}>
                                            {statusLabel(order.status)}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            type="button"
                                            className="btn btn-outline btn-small"
                                            onClick={() => handleView(order)}
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="admin-state">
                    <h2>No orders found</h2>
                    <p>Try another search or filter.</p>
                </div>
            )}
            <div className="admin-pagination">
                <button className="btn btn-outline btn-small" disabled={!pagination.hasPreviousPage || loading} onClick={() => setPage(value => value - 1)}>Previous</button>
                <span>Page {pagination.page || page} of {pagination.totalPages || 1}</span>
                <button className="btn btn-outline btn-small" disabled={!pagination.hasNextPage || loading} onClick={() => setPage(value => value + 1)}>Next</button>
            </div>
            {selectedOrder && (
                <div
                    className="order-modal-overlay"
                    onClick={event => event.target === event.currentTarget && closeView()}
                >
                    <div className="order-modal" role="dialog" aria-modal="true" aria-label="Order details">
                        <div className="order-modal-header">
                            <div>
                                <p className="order-modal-eyebrow">Order details</p>
                                <h2>#{detail?.orderNumber || selectedOrder.orderNumber}</h2>
                            </div>
                            <button
                                type="button"
                                className="order-modal-close"
                                onClick={closeView}
                                aria-label="Close order details"
                            >
                                ×
                            </button>
                        </div>

                        {detailLoading ? (
                            <div className="admin-state">Loading order details...</div>
                        ) : detailError ? (
                            <div className="admin-alert">{detailError}</div>
                        ) : detail ? (
                            <>
                                <div className="order-modal-badges">
                                    <span className={statusBadgeClass(detail.status)}>{statusLabel(detail.status)}</span>
                                    <span className={paymentBadgeClass(detail.paymentStatus)}>{paymentLabel(detail.paymentStatus)}</span>
                                </div>

                                <div className="order-modal-grid">
                                    <div className="order-modal-section">
                                        <h3>Customer</h3>
                                        <p><strong>{detail.customerName || '-'}</strong></p>
                                        {detail.customerEmail && <p>{detail.customerEmail}</p>}
                                        {detail.customerPhone && <p>{detail.customerPhone}</p>}
                                        <p className="order-modal-muted">
                                            {detail.customerId
                                                ? `Registered customer #${detail.customerId}`
                                                : 'Guest order (no account)'}
                                        </p>
                                    </div>
                                    <div className="order-modal-section">
                                        <h3>Shipping address</h3>
                                        {detail.shippingAddress ? (
                                            <p>
                                                {detail.shippingAddress.fullName}<br />
                                                {detail.shippingAddress.line1}<br />
                                                {detail.shippingAddress.city}, {detail.shippingAddress.state} {detail.shippingAddress.postalCode}<br />
                                                {detail.shippingAddress.country}
                                                {detail.shippingAddress.phone && <><br />{detail.shippingAddress.phone}</>}
                                            </p>
                                        ) : (
                                            <p className="order-modal-muted">No shipping address on record.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="order-modal-section">
                                    <h3>Items</h3>
                                    {detail.items.length ? (
                                        <div className="admin-table-wrap">
                                            <table className="admin-table order-items-table">
                                                <thead>
                                                    <tr>
                                                        <th>Product</th>
                                                        <th>Size</th>
                                                        <th>Qty</th>
                                                        <th>Unit price</th>
                                                        <th>Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {detail.items.map(item => (
                                                        <tr key={item.id}>
                                                            <td>{item.productName}</td>
                                                            <td>{item.size || '-'}</td>
                                                            <td>{item.quantity}</td>
                                                            <td>{formatMoney(item.unitPrice)}</td>
                                                            <td>{formatMoney(item.lineTotal)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p className="order-modal-muted">No items recorded for this order.</p>
                                    )}
                                </div>

                                <div className="order-modal-totals">
                                    <div><span>Subtotal</span><strong>{formatMoney(detail.subtotal)}</strong></div>
                                    <div><span>Shipping</span><strong>{formatMoney(detail.shipping)}</strong></div>
                                    <div className="order-modal-total"><span>Total</span><strong>{formatMoney(detail.total)}</strong></div>
                                </div>

                                <div className="order-modal-dates">
                                    <span>Placed: {formatDateTime(detail.orderDate)}</span>
                                    {detail.updatedAt && detail.updatedAt !== detail.orderDate && (
                                        <span>Updated: {formatDateTime(detail.updatedAt)}</span>
                                    )}
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            )}
        </section>
        );

    }
