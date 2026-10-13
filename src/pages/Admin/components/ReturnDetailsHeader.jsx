import React from 'react';

// Detail-modal header: eyebrow, return number, order number and the close (×).
export default function ReturnDetailsHeader({ selectedReturn, onClose }) {
    return (
        <div className="order-modal-header">
            <div>
                <p className="admin-page-eyebrow">Return details</p>
                <h2>{selectedReturn.returnNumber}</h2>
                <p className="muted">Order #{selectedReturn.orderNumber}</p>
            </div>
            <button
                type="button"
                className="order-modal-close"
                onClick={onClose}
                aria-label="Close return details"
            >
                ×
            </button>
        </div>
    );
}
