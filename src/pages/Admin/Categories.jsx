import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchJson } from '../../utils/api';
import '../../styles/admin/shared/admin-shared.css';

export default function Categories() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [newCategoryName, setNewCategoryName] = useState('');

    const loadCategories = async () => {
        setLoading(true);
        setError('');
        try {
            // const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/catalog/categories`);
            // if (!response.ok) throw new Error('Failed to load categories');
            // const data = await response.json();
            // setCategories(data);
            const data = await fetchJson('/api/catalog/categories');
            setCategories(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCategories();
    }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;

        try {
            await fetchJson('/api/catalog/categories', {
                method: 'POST',
                body: JSON.stringify({
                    name: newCategoryName.trim(),
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create category');
            }
            setNewCategoryName('');
            setShowAddForm(false);
            loadCategories();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        if (!editingCategory || !editingCategory.name.trim()) return;

        try {
            // const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/catalog/categories/${editingCategory.id}`, {
            //     method: 'PUT',
            //     headers: { 'Content-Type': 'application/json' },
            //     credentials: 'include',
            //     body: JSON.stringify({ name: editingCategory.name.trim() }),
            // });
            await fetchJson(
                `/api/catalog/categories/${editingCategory.id}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: editingCategory.name.trim(),
                    }),
                }
            );
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update category');
            }
            setEditingCategory(null);
            loadCategories();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this category? This will not affect existing products.')) return;

        try {
            // const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/catalog/categories/${id}`, {
            //     method: 'DELETE',
            //     credentials: 'include',
            // });
            await fetchJson(`/api/catalog/categories/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete category');
            }
            loadCategories();
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) return <div className="admin-state">Loading categories...</div>;

    return (

        <section className="admin-page categories-page">
            <div className="admin-page-heading">
                <div>
                    <p className="admin-eyebrow">Catalog</p>
                    <h1>Categories</h1>
                    <p>Manage product categories</p>
                </div>

                {/* Header action buttons */}
                <div className="categories-header-actions">
                    <Link className="btn btn-outline" to="/admin">
                        ← Back
                    </Link>

                    <button
                        className="btn btn-primary"
                        onClick={() => setShowAddForm(!showAddForm)}
                    >
                        {showAddForm ? 'Cancel' : '+ Add Category'}
                    </button>
                </div>
            </div>

            {error && <div className="admin-alert">{error}</div>}

            {showAddForm && (
                <form className="admin-form" onSubmit={handleAdd}>
                    <div className="admin-field">
                        <span>Category Name</span>
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="Enter category name"
                            autoFocus
                        />
                    </div>

                    <div className="admin-form-actions">
                        <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => setShowAddForm(false)}
                        >
                            Cancel
                        </button>

                        <button type="submit" className="btn btn-primary">
                            Add Category
                        </button>
                    </div>
                </form>
            )}

            {/* Updated Categories Table */}
            <div className="admin-table-container">
                {categories.length === 0 ? (
                    <div className="admin-state">No categories found</div>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Category Name</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map((category) => (
                                <tr key={category.id} className="category-row">
                                    {editingCategory?.id === category.id ? (
                                        /* Edit form inside table row */
                                        <td colSpan="2">
                                            <form
                                                onSubmit={handleEdit}
                                                className="category-edit-form"
                                            >
                                                <input
                                                    type="text"
                                                    value={editingCategory.name}
                                                    onChange={(e) =>
                                                        setEditingCategory({
                                                            ...editingCategory,
                                                            name: e.target.value,
                                                        })
                                                    }
                                                    autoFocus
                                                />

                                                <div className="category-actions">
                                                    <button
                                                        type="submit"
                                                        className="btn btn-primary btn-small"
                                                    >
                                                        Save
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="btn btn-outline btn-small"
                                                        onClick={() => setEditingCategory(null)}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </form>
                                        </td>
                                    ) : (
                                        <>
                                            <td className="category-name-cell">
                                                {category.name}
                                            </td>
                                            <td className="category-actions-cell text-right">
                                                <div className="category-actions">
                                                    <button
                                                        className="btn btn-outline btn-small"
                                                        onClick={() => setEditingCategory(category)}
                                                    >
                                                        Edit
                                                    </button>

                                                    <button
                                                        className="btn btn-danger btn-small"
                                                        onClick={() => handleDelete(category.id)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </section>
    );
}
