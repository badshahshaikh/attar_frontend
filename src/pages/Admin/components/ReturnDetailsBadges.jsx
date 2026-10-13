import React from 'react';
import { formatMoney, formatDateTime } from '../returnsFormat';
import ReturnStatusBadge from './ReturnStatusBadge';

// Badge strip under the detail header: status, refunded amount and inspection date.
export default function ReturnDetailsBadges({ selectedReturn, detail }) {
    return (
        <div className="return-badges">
            <ReturnStatusBadge status={selectedReturn.status} />
            {detail && detail.refundAmount != null && (
                <span className="status status-good">
                    Refunded {formatMoney(detail.refundAmount)}
                </span>
            )}
            {detail && detail.inspectedAt && (
                <span className="status status-neutral">
                    Inspected {formatDateTime(detail.inspectedAt)}
                </span>
            )}
        </div>
    );
}
