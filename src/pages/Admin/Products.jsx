import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductTable from '../../components/admin/ProductTable';
import { deleteProduct, deleteProducts, fetchProducts } from '../../services/productService';

export default function Products() {
    const [data, setData] = useState({ products: [], pagination: {} });
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [showBulkConfirm, setShowBulkConfirm] = useState(false);

    const load = async () => {
        setLoading(true);
        setError('');

        try {
            const result = await fetchProducts({
                page,
                limit: 10,
                search
            });

            setData(result);
        } catch (loadError) {
            setError(
                loadError.status === 401
                    ? 'Your session has expired.'
                    : 'Unable to load products.'
            );
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, [page, search]);

    const handleDelete = async product => {
        if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
        setDeletingId(product.id); setError(''); setNotice('');
        try {
            await deleteProduct(product.id);
            // A product deleted individually may still sit in the selection.
            setSelectedIds(previous => {
                const next = new Set(previous);
                next.delete(product.id);
                return next;
            });
            await load();
        } catch (deleteError) { setError(deleteError.status === 401 ? 'Your session has expired. Please sign in again.' : deleteError.message); } finally { setDeletingId(null); }
    };

    const handleToggleSelect = (id, checked) => {
        setSelectedIds(previous => {
            const next = new Set(previous);
            if (checked) next.add(id); else next.delete(id);
            return next;
        });
    };

    const handleToggleSelectAll = checked => {
        setSelectedIds(previous => {
            const next = new Set(previous);
            data.products.forEach(product => {
                if (checked) next.add(product.id); else next.delete(product.id);
            });
            return next;
        });
    };

    const clearSelection = () => setSelectedIds(new Set());

    const handleBulkDelete = async () => {
        if (bulkDeleting || selectedIds.size === 0) return;
        const ids = [...selectedIds];
        setBulkDeleting(true);
        setError('');
        setNotice('');
        try {
            const result = await deleteProducts(ids);
            const deletedIds = new Set(result.deletedIds || []);
            const notFoundIds = new Set(result.notFoundIds || []);

            // Drop every id the server confirmed as gone (deleted now, or
            // already missing) so stale rows can never be re-submitted.
            setSelectedIds(previous => {
                const next = new Set(previous);
                deletedIds.forEach(id => next.delete(id));
                notFoundIds.forEach(id => next.delete(id));
                return next;
            });
            setShowBulkConfirm(false);

            const deletedCount = result.deletedCount ?? deletedIds.size;
            const missingCount = notFoundIds.size;
            setNotice(
                missingCount > 0
                    ? `Deleted ${deletedCount} product${deletedCount === 1 ? '' : 's'}. ${missingCount} selected product${missingCount === 1 ? ' was' : 's were'} no longer found.`
                    : `Deleted ${deletedCount} product${deletedCount === 1 ? '' : 's'}.`
            );
            await load();
        } catch (bulkError) {
            setError(
                bulkError.status === 401
                    ? 'Your session has expired. Please sign in again.'
                    : bulkError.message || 'Failed to delete selected products.'
            );
        } finally {
            setBulkDeleting(false);
        }
    };

    const pagination = data.pagination || {};
    return (
        <section className="admin-page">
            <div className="admin-page-heading">
                <div>
                    <p className="admin-eyebrow">Catalog</p>
                    <h1>Products</h1>
                    <p>{pagination.totalProducts ?? data.products.length} products in your catalog.</p>
                </div>
                <div className="admin-page-actions">
                    <Link className="btn btn-outline" to="/admin/products/bulk">
                        Bulk Manage
                    </Link>

                    <Link className="btn btn-primary" to="/admin/products/new">
                        Create product
                    </Link>
                </div>
            </div>
            <div className="admin-toolbar">
                <div className="admin-search">
                    <label htmlFor="product-search">Search products</label>
                    <input
                        id="product-search"
                        type="search"
                        value={search}
                        onChange={event => {
                            setPage(1);
                            setSearch(event.target.value);
                        }}
                        placeholder="Search by name, brand or fragrance family..."
                    />
                </div>
            </div>
            {error && <div className="admin-alert">{error}</div>}
            {notice && <div className="admin-alert admin-alert-success">{notice}</div>}

            {selectedIds.size > 0 && (
                <div className="admin-bulk-bar" role="toolbar" aria-label="Bulk product actions">
                    <span className="admin-bulk-count">
                        {selectedIds.size} product{selectedIds.size === 1 ? '' : 's'} selected
                    </span>
                    <div className="admin-bulk-actions">
                        <button
                            className="btn btn-danger"
                            type="button"
                            disabled={bulkDeleting}
                            onClick={() => setShowBulkConfirm(true)}
                        >
                            Delete Selected
                        </button>
                        <button
                            className="btn btn-outline"
                            type="button"
                            disabled={bulkDeleting}
                            onClick={clearSelection}
                        >
                            Clear Selection
                        </button>
                    </div>
                </div>
            )}

            {loading ? <div className="admin-state">Loading products...</div> : data.products.length ? <ProductTable products={data.products} deletingId={deletingId} onDelete={handleDelete} selectedIds={selectedIds} onToggleSelect={handleToggleSelect} onToggleSelectAll={handleToggleSelectAll} bulkDeleting={bulkDeleting} /> : <div className="admin-state"><h2>No products found</h2><p>Try another search or add your first product.</p></div>}
            <div className="admin-pagination">
                <button className="btn btn-outline btn-small" disabled={!pagination.hasPreviousPage || loading} onClick={() => setPage(value => value - 1)}>Previous</button>
                <span>Page {pagination.page || page} of {pagination.totalPages || 1}</span>
                <button className="btn btn-outline btn-small" disabled={!pagination.hasNextPage || loading} onClick={() => setPage(value => value + 1)}>Next</button>
            </div>

            {showBulkConfirm && (
                <div
                    className="admin-modal-overlay"
                    onClick={event => {
                        if (event.target === event.currentTarget && !bulkDeleting) setShowBulkConfirm(false);
                    }}
                >
                    <div
                        className="admin-modal"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="bulk-delete-title"
                        aria-describedby="bulk-delete-desc"
                    >
                        <div className="admin-modal-header">
                            <h2 id="bulk-delete-title">
                                Delete {selectedIds.size} product{selectedIds.size === 1 ? '' : 's'}?
                            </h2>
                        </div>
                        <p id="bulk-delete-desc" className="admin-modal-text">
                            You are about to permanently delete {selectedIds.size} selected product{selectedIds.size === 1 ? '' : 's'} from your catalog.
                            This action cannot be undone.
                        </p>
                        <div className="admin-modal-actions">
                            <button
                                className="btn btn-outline"
                                type="button"
                                disabled={bulkDeleting}
                                onClick={() => setShowBulkConfirm(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-danger"
                                type="button"
                                disabled={bulkDeleting}
                                onClick={handleBulkDelete}
                            >
                                {bulkDeleting ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
