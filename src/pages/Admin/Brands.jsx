import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Admin.css';

export default function Brands() {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingBrand, setEditingBrand] = useState(null);
    const [newBrandName, setNewBrandName] = useState('');

    const loadBrands = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/catalog/brands`);
            if (!response.ok) throw new Error('Failed to load brands');
            const data = await response.json();
            setBrands(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBrands();
    }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newBrandName.trim()) return;

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/catalog/brands`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: newBrandName.trim() }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create brand');
            }
            setNewBrandName('');
            setShowAddForm(false);
            loadBrands();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        if (!editingBrand || !editingBrand.name.trim()) return;

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/catalog/brands/${editingBrand.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: editingBrand.name.trim() }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update brand');
            }
            setEditingBrand(null);
            loadBrands();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this brand? This will not affect existing products.')) return;

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/catalog/brands/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete brand');
            }
            loadBrands();
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) return <div className="admin-state">Loading brands...</div>;

    return (
        <section className="admin-page">
            <div className="admin-page-heading">
                <div>
                    <p className="admin-eyebrow">Catalog</p>
                    <h1>Brands</h1>
                    <p>Manage product brands</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Link className="btn btn-outline" to="/admin">← Back</Link>
                    <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
                        {showAddForm ? 'Cancel' : '+ Add Brand'}
                    </button>
                </div>
            </div>

            {error && <div className="admin-alert">{error}</div>}

            {showAddForm && (
                <form className="admin-form" onSubmit={handleAdd}>
                    <div className="admin-field">
                        <span>Brand Name</span>
                        <input
                            type="text"
                            value={newBrandName}
                            onChange={(e) => setNewBrandName(e.target.value)}
                            placeholder="Enter brand name"
                            autoFocus
                        />
                    </div>
                    <div className="admin-form-actions">
                        <button type="button" className="btn btn-outline" onClick={() => setShowAddForm(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Add Brand</button>
                    </div>
                </form>
            )}

            <div className="admin-list">
                {brands.length === 0 ? (
                    <div className="admin-state">No brands found</div>
                ) : (
                    brands.map((brand) => (
                        <div key={brand.id} className="admin-list-item">
                            {editingBrand?.id === brand.id ? (
                                <form onSubmit={handleEdit} style={{ display: 'flex', gap: '10px', flex: 1 }}>
                                    <input
                                        type="text"
                                        value={editingBrand.name}
                                        onChange={(e) => setEditingBrand({ ...editingBrand, name: e.target.value })}
                                        autoFocus
                                    />
                                    <button type="submit" className="btn btn-primary btn-small">Save</button>
                                    <button type="button" className="btn btn-outline btn-small" onClick={() => setEditingBrand(null)}>Cancel</button>
                                </form>
                            ) : (
                                <>
                                    <span>{brand.name}</span>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <button className="btn btn-outline btn-small" onClick={() => setEditingBrand(brand)}>Edit</button>
                                        <button className="btn btn-danger btn-small" onClick={() => handleDelete(brand.id)}>Delete</button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>
        </section>
    );
}
