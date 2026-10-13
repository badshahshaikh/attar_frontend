import React from 'react';

// Previous / Next pagination. `setPage` is the parent's state setter so the
// functional-update guards (Math.max(1, …), value + 1) behave exactly as before.
export default function ReturnsPagination({ pagination, page, loading, setPage }) {
    return (
        <>
            {pagination.totalPages > 1 && (
                <div className="admin-pagination">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={!pagination.hasPreviousPage || loading}
                        onClick={() => setPage((value) => Math.max(1, value - 1))}
                    >
                        Previous
                    </button>
                    <span>Page {pagination.page || page} of {pagination.totalPages}</span>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={!pagination.hasNextPage || loading}
                        onClick={() => setPage((value) => value + 1)}
                    >
                        Next
                    </button>
                </div>
            )}
        </>
    );
}
