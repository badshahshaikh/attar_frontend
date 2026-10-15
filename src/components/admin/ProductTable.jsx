import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { isProductAvailable } from '../../utils/stock';

export default function ProductTable({
    products,
    deletingId,
    onDelete,
    selectedIds,
    onToggleSelect,
    onToggleSelectAll,
    bulkDeleting = false
}) {
    const selectableIds = products.map(product => product.id);
    const selectedOnPage = selectableIds.filter(id => selectedIds && selectedIds.has(id)).length;
    const allSelectedOnPage = selectableIds.length > 0 && selectedOnPage === selectableIds.length;
    const someSelectedOnPage = selectedOnPage > 0 && !allSelectedOnPage;

    // The indeterminate attribute is DOM-only, so mirror it with a ref.
    const selectAllRef = useRef(null);
    useEffect(() => {
        if (selectAllRef.current) {
            selectAllRef.current.indeterminate = someSelectedOnPage;
        }
    }, [someSelectedOnPage]);

    const canSelect = Boolean(onToggleSelect && onToggleSelectAll);

    return (
        <div className="admin-table-wrap">
            <table className="admin-table">
                <thead>
                    <tr>
                        {canSelect && (
                            <th className="admin-table-checkbox">
                                <input
                                    ref={selectAllRef}
                                    type="checkbox"
                                    className="admin-checkbox"
                                    aria-label="Select all products on this page"
                                    checked={allSelectedOnPage}
                                    disabled={bulkDeleting || selectableIds.length === 0}
                                    onChange={event => onToggleSelectAll(event.target.checked)}
                                />
                            </th>
                        )}
                        <th>Product</th><th>Brand</th><th>Category</th><th>Price</th><th>Status</th><th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {products.map(product => (
                        <tr key={product.id}>
                            {canSelect && (
                                <td className="admin-table-checkbox">
                                    <input
                                        type="checkbox"
                                        className="admin-checkbox"
                                        aria-label={`Select ${product.name}`}
                                        checked={Boolean(selectedIds && selectedIds.has(product.id))}
                                        disabled={bulkDeleting}
                                        onChange={event => onToggleSelect(product.id, event.target.checked)}
                                    />
                                </td>
                            )}
                            <td >
                                <div className="admin-product-cell">
                                    <img src={product.imageUrl || '/placeholder-product.jpg'} alt="" />
                                    <span>{product.name}</span>
                                </div>
                            </td>
                            <td>{product.brand || '-'}</td>
                            <td>{product.fragranceType || product.category || '-'}</td>
                            <td>Rs. {Number(product.price || 0).toLocaleString('en-IN')}</td>
                            <td><span className={isProductAvailable(product) ? 'status status-good' : 'status'}>{isProductAvailable(product) ? 'In stock' : 'Out of stock'}</span></td>
                            <td >
                                <div className="admin-row-actions" >
                                    <Link className="btn btn-outline btn-small" to={`/admin/products/${product.id}/edit`}>Edit</Link>
                                    <button className="btn btn-danger btn-small" type="button" disabled={deletingId === product.id || bulkDeleting} onClick={() => onDelete(product)}>
                                        {deletingId === product.id ? 'Deleting...' : 'Delete'}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
