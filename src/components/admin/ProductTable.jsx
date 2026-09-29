import React from 'react';
import { Link } from 'react-router-dom';

export default function ProductTable({ products, deletingId, onDelete }) {
    return (
        <div className="admin-table-wrap">
            <table className="admin-table">
                <thead>
                    <tr><th>Product</th><th>Brand</th><th>Category</th><th>Price</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    {products.map(product => (
                        <tr key={product.id}>
                            <td >
                                <div className="admin-product-cell">
                                    <img src={product.imageUrl || '/placeholder-product.jpg'} alt="" />
                                    <span>{product.name}</span>
                                </div>
                            </td>
                            <td>{product.brand || '-'}</td>
                            <td>{product.fragranceType || product.category || '-'}</td>
                            <td>Rs. {Number(product.price || 0).toLocaleString('en-IN')}</td>
                            <td><span className={product.inStock ? 'status status-good' : 'status'}>{product.inStock ? 'In stock' : 'Out of stock'}</span></td>
                            <td >
                                <div className="admin-row-actions" >
                                    <Link className="btn btn-outline btn-small" to={`/admin/products/${product.id}/edit`}>Edit</Link>
                                    <button className="btn btn-danger btn-small" type="button" disabled={deletingId === product.id} onClick={() => onDelete(product)}>
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
