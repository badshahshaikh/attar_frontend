import React from 'react';
import { formatMoney, formatDate, formatDateTime } from '../returnsFormat';

// Two-column facts grid: the original order summary and the return metadata.
export default function ReturnDetailsFacts({ detail }) {
    return (
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
    );
}
