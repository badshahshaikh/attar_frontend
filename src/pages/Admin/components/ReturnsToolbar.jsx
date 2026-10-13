import React from 'react';
import { RETURN_STATUS_OPTIONS, statusLabel } from '../returnsConstants';

// Search + status filter toolbar. Both inputs reset pagination to page 1,
// mirroring the original inline behaviour.
export default function ReturnsToolbar({ search, statusFilter, onSearchChange, onStatusChange }) {
    return (
        <div className="admin-toolbar">
            <input
                type="text"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search returns..."
            />
            <select
                value={statusFilter}
                onChange={(event) => onStatusChange(event.target.value)}
                className="admin-select"
            >
                <option value="">All statuses</option>
                {RETURN_STATUS_OPTIONS.map((value) => (
                    <option key={value} value={value}>{statusLabel(value)}</option>
                ))}
            </select>
        </div>
    );
}
