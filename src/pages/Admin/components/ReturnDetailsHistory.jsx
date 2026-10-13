import React from 'react';
import { formatDateTime } from '../returnsFormat';
import { statusLabel } from '../returnsConstants';

// Status-change history timeline. Renders nothing when there is no history.
export default function ReturnDetailsHistory({ detail }) {
    if (!(detail.history || []).length) {
        return null;
    }

    return (
        <section className="return-section">
            <h3>History</h3>
            <ul className="return-history">
                {detail.history.map((entry) => (
                    <li key={entry.id}>
                        <span className="return-history-status">
                            {entry.fromStatus
                                ? `${statusLabel(entry.fromStatus)} → ${statusLabel(entry.toStatus)}`
                                : statusLabel(entry.toStatus)}
                        </span>
                        <span className="muted">
                            {formatDateTime(entry.createdAt)}
                            {entry.changedByAdminName
                                ? ` · ${entry.changedByAdminName}`
                                : ''}
                        </span>
                        {entry.note && <p>{entry.note}</p>}
                    </li>
                ))}
            </ul>
        </section>
    );
}
