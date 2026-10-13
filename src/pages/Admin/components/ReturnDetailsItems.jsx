import React from 'react';
import { formatMoney, formatDate } from '../returnsFormat';

// Returned-items table plus the customer reason / internal notes section.
export default function ReturnDetailsItems({ detail }) {
    return (
        <>
            <section className="return-section">
                <h3>Returned items</h3>
                <div className="order-items-wrap">
                    <table className="order-items">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Qty</th>
                                <th>Ordered</th>
                                <th>Unit price</th>
                                <th>Line total</th>
                                <th>Stock</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(detail.items || []).map((item) => (
                                <tr key={item.id}>
                                    <td>
                                        <strong>{item.productName}</strong>
                                        <span className="muted">{item.size || '-'}</span>
                                    </td>
                                    <td>{item.quantity}</td>
                                    <td>{item.orderedQuantity ?? '-'}</td>
                                    <td>{formatMoney(item.unitPrice)}</td>
                                    <td>{formatMoney(item.lineTotal)}</td>
                                    <td>
                                        {item.stockRestored
                                            ? `Restored ${formatDate(item.restoredAt)}`
                                            : 'Not restored'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="return-section">
                <h3>Customer reason</h3>
                <p>{detail.customerReason || '-'}</p>
                {detail.internalNotes && (
                    <>
                        <h3>Internal notes</h3>
                        <p>{detail.internalNotes}</p>
                    </>
                )}
            </section>
        </>
    );
}
