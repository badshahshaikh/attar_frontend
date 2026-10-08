import React, { useEffect, useState } from 'react';
import { fetchCustomers } from '../../services/adminUserService';

export default function Customers() {
    const [data, setData] = useState({ customers: [], pagination: {} });
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');

        try {
            const result = await fetchCustomers({
                page,
                limit: 10,
                search
            });

            setData(result);
        } catch (loadError) {
            setError(
                loadError.status === 401
                    ? 'Your session has expired.'
                    : loadError.status === 403
                        ? 'You do not have permission to view registered users.'
                        : 'Unable to load customers.'
            );
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, [page, search]);

    const formatDate = (value) => (
        value
            ? new Date(value).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            })
            : '-'
    );

    const pagination = data.pagination || {};
    return (
        <section className="admin-page">
            <div className="admin-page-heading">
                <div>
                    <p className="admin-eyebrow">Customers</p>
                    <h1>Registered Users</h1>
                    <p>{pagination.totalCustomers ?? data.customers.length} registered customers.</p>
                </div>
            </div>
            <div className="admin-toolbar">
                <div className="admin-search">
                    <label htmlFor="customer-search">Search users</label>
                    <input
                        id="customer-search"
                        type="search"
                        value={search}
                        onChange={event => {
                            setPage(1);
                            setSearch(event.target.value);
                        }}
                        placeholder="Search by name, email or phone..."
                    />
                </div>
            </div>
            {error && <div className="admin-alert">{error}</div>}

            {loading ? (
                <div className="admin-state">Loading customers...</div>
            ) : data.customers.length ? (
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Registered Date</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.customers.map(customer => (
                                <tr key={customer.id}>
                                    <td>{customer.fullName || '-'}</td>
                                    <td>{customer.email || '-'}</td>
                                    <td>{customer.phone || '-'}</td>
                                    <td>{formatDate(customer.registeredAt)}</td>
                                    <td>
                                        <span className={customer.status === 'active' ? 'status status-good' : 'status'}>
                                            {customer.status === 'active' ? 'Active' : 'New'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="admin-state">
                    <h2>No customers found</h2>
                    <p>Try another search.</p>
                </div>
            )}
            <div className="admin-pagination">
                <button className="btn btn-outline btn-small" disabled={!pagination.hasPreviousPage || loading} onClick={() => setPage(value => value - 1)}>Previous</button>
                <span>Page {pagination.page || page} of {pagination.totalPages || 1}</span>
                <button className="btn btn-outline btn-small" disabled={!pagination.hasNextPage || loading} onClick={() => setPage(value => value + 1)}>Next</button>
            </div>
        </section>
    );
}