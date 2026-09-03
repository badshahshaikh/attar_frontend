import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { fetchProducts } from '../../services/productService';

export default function AdminDashboard() {
    const [total, setTotal] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchProducts().then(data => setTotal(data.pagination?.totalProducts ?? data.products?.length ?? data.length)).catch(() => setError('Unable to load product totals.'));
    }, []);

    return <AdminLayout><section className="admin-page"><div className="admin-page-heading"><div><p className="admin-eyebrow">Overview</p><h1>Dashboard</h1><p>Manage the catalog that powers your storefront.</p></div><Link className="btn btn-primary" to="/admin/products">Manage products</Link></div><div className="admin-summary"><div><span>Total products</span><strong>{error ? '-' : total ?? '...'}</strong></div><div><span>Catalog status</span><strong>Live</strong></div></div><div className="admin-quick-links"><Link to="/admin/products">View product catalog <span>→</span></Link><Link to="/admin/products/new">Add a new product <span>→</span></Link></div></section></AdminLayout>;
}
