import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import ProductFormFields from '../../components/admin/ProductFormFields';
import ImageUpload from '../../components/admin/ImageUpload';
import { createProduct, fetchProductById, updateProduct } from '../../services/productService';
import './Admin.css';

const emptyProduct = { name: '', category: 'Attar', fragranceType: '', brand: '', price: '', originalPrice: '', stockQuantity: 0, longevity: '', rating: 0, reviews: 0, sizes: '', sizePricing: '{}', topNotes: '', heartNotes: '', baseNotes: '', description: '', fullDescription: '', inStock: true, isNew: false, isBestSeller: false, isExclusive: false, featured: false, imageUrl: '' };
const csv = value => Array.isArray(value) ? value.join(', ') : '';
function toForm(product) { return { ...emptyProduct, ...product, sizes: csv(product.sizes), topNotes: csv(product.topNotes), heartNotes: csv(product.heartNotes), baseNotes: csv(product.baseNotes), sizePricing: JSON.stringify(product.sizePricing || {}), originalPrice: product.originalPrice ?? '', imageUrl: product.imageUrl || '' }; }
const list = value => value.split(',').map(item => item.trim()).filter(Boolean);

export default function ProductForm() {
    const { id } = useParams();
    const editing = Boolean(id);
    const navigate = useNavigate();
    const [values, setValues] = useState(emptyProduct);
    const [loading, setLoading] = useState(editing);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => { if (!editing) return; fetchProductById(id).then(product => setValues(toForm(product))).catch(loadError => setError(loadError.status === 404 ? 'Product not found.' : 'Unable to load this product.')).finally(() => setLoading(false)); }, [id, editing]);

    const handleSubmit = async event => {
        event.preventDefault(); setError('');
        let sizePricing;
        try { sizePricing = values.sizePricing.trim() ? JSON.parse(values.sizePricing) : {}; } catch { setError('Size pricing must be valid JSON, for example {"3ml":199}.'); return; }
        const payload = { ...values, price: Number(values.price), originalPrice: values.originalPrice === '' ? null : Number(values.originalPrice), stockQuantity: Number(values.stockQuantity), rating: Number(values.rating), reviews: Number(values.reviews), sizes: list(values.sizes), sizePricing, topNotes: list(values.topNotes), heartNotes: list(values.heartNotes), baseNotes: list(values.baseNotes) };
        setSaving(true);
        try { if (editing) await updateProduct(id, payload); else await createProduct(payload); navigate('/admin/products'); } catch (saveError) { setError(saveError.status === 401 ? 'Your session has expired. Please sign in again.' : saveError.status === 400 ? saveError.message : 'Unable to save product. Please check the form and try again.'); } finally { setSaving(false); }
    };

    return <AdminLayout><section className="admin-page"><div className="admin-page-heading"><div><p className="admin-eyebrow">Catalog</p><h1>{editing ? 'Edit product' : 'Create product'}</h1><p>{editing ? 'Update the product details and save the changes.' : 'Add a product to the live catalog.'}</p></div><Link className="btn btn-outline" to="/admin/products">Cancel</Link></div>{loading ? <div className="admin-state">Loading product...</div> : <form className="admin-form" onSubmit={handleSubmit}><ProductFormFields values={values} onChange={setValues} /><div className="admin-field admin-field-wide"><span>Product image</span><ImageUpload imageUrl={values.imageUrl} productId={id} onUploaded={imageUrl => setValues(current => ({ ...current, imageUrl }))} /></div>{error && <div className="admin-alert">{error}</div>}<div className="admin-form-actions"><Link className="btn btn-outline" to="/admin/products">Cancel</Link><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save changes' : 'Create product'}</button></div></form>}</section></AdminLayout>;
}
