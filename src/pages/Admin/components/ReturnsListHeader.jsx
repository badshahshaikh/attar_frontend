import React from 'react';

// Page header for the Returns list: title, live count and the "New Return" CTA.
export default function ReturnsListHeader({ totalReturns, pageMessage, onNewReturn }) {
    return (
        <>
            <div className="admin-page-header">
                <div>
                    <p className="admin-page-eyebrow">Sales</p>
                    <h2>Returns</h2>
                    <p>{totalReturns} customer return{totalReturns === 1 ? '' : 's'}</p>
                </div>
                <div className="admin-page-actions">
                    <button type="button" className="btn btn-primary" onClick={onNewReturn}>
                        New Return
                    </button>
                </div>
            </div>

            {pageMessage && <div className="admin-message">{pageMessage}</div>}
        </>
    );
}
