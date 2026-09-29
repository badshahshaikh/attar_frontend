import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductTable from '../../components/admin/ProductTable';
import { deleteProduct, fetchProducts } from '../../services/productService';

export default function Products() {
    const [data, setData] = useState({ products: [], pagination: {} });
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState('');

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
        setDeletingId(product.id); setError('');
        try { await deleteProduct(product.id); await load(); } catch (deleteError) { setError(deleteError.status === 401 ? 'Your session has expired. Please sign in again.' : deleteError.message); } finally { setDeletingId(null); }
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

            {loading ? <div className="admin-state">Loading products...</div> : data.products.length ? <ProductTable products={data.products} deletingId={deletingId} onDelete={handleDelete} /> : <div className="admin-state"><h2>No products found</h2><p>Try another search or add your first product.</p></div>}
            <div className="admin-pagination">
                <button className="btn btn-outline btn-small" disabled={!pagination.hasPreviousPage || loading} onClick={() => setPage(value => value - 1)}>Previous</button>
                <span>Page {pagination.page || page} of {pagination.totalPages || 1}</span>
                <button className="btn btn-outline btn-small" disabled={!pagination.hasNextPage || loading} onClick={() => setPage(value => value + 1)}>Next</button>
            </div>
        </section>
    );
}
