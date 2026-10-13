import React from 'react';
import ReturnsTableRow from './ReturnsTableRow';

// The returns table wrapper: renders loading / empty / populated states.
// Kept as its own component so the list page stays focused on data + wiring.
export default function ReturnsTable({ loading, returns, onView }) {
    return (
        <div className="admin-table-wrap">
            {loading ? (
                <div className="admin-state">Loading returns...</div>
            ) : returns.length === 0 ? (
                <div className="admin-state">No returns found.</div>
            ) : (
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Return</th>
                            <th>Order</th>
                            <th>Created</th>
                            <th>Status</th>
                            <th>Refund</th>
                            <th aria-label="Actions" />
                        </tr>
                    </thead>
                    <tbody>
                        {returns.map((row) => (
                            <ReturnsTableRow key={row.id} row={row} onView={onView} />
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
