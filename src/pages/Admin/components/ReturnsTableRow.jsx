import React from 'react';
import { formatMoney, formatDate } from '../returnsFormat';
import ReturnStatusBadge from './ReturnStatusBadge';

// A single returns-table row. Mirrors the original markup exactly so the
// list rendering and its tests are unchanged.
export default function ReturnsTableRow({ row, onView }) {
    return (
        <tr key={row.id}>
            <td>
                <div className="admin-user-cell">
                    <strong>{row.returnNumber}</strong>
                    {row.inspectedAt && (
                        <span className="muted">Inspected {formatDate(row.inspectedAt)}</span>
                    )}
                </div>
            </td>
            <td><strong>#{row.orderNumber}</strong></td>
            <td>{formatDate(row.createdAt)}</td>
            <td>
                <ReturnStatusBadge status={row.status} />
            </td>
            <td>
                {row.refundAmount != null ? (
                    <span className="status status-good">{formatMoney(row.refundAmount)}</span>
                ) : row.status === 'refund_pending' ? (
                    <span className="status status-neutral">Pending</span>
                ) : (
                    '-'
                )}
            </td>
            <td>
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => onView(row)}
                >
                    View
                </button>
            </td>
        </tr>
    );
}
