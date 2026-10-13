import React from 'react';
import { statusLabel, statusBadgeClass } from '../returnsConstants';

// Reusable status pill. Refunded → green, rejected → red, everything else
// neutral (Orders convention). Used in the list table and the detail modal.
export default function ReturnStatusBadge({ status }) {
    return (
        <span className={statusBadgeClass(status)}>
            {statusLabel(status)}
        </span>
    );
}
