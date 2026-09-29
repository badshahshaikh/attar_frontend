import React, { useState, useEffect } from 'react';

import { Link, useParams } from 'react-router-dom';
import ProductFormFields from '../../components/admin/ProductFormFields';
import ImageUpload from '../../components/admin/ImageUpload';
import { useProductForm } from '../../features/products/hooks/useProductForm';
import '../../components/admin/admin.css';
import { generateProductWithAI } from '../../services/productService';

// D:\attar_frontend\src\components\admin\admin.css

export default function ProductForm() {

    const [aiProductName, setAiProductName] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    const { id } = useParams();
    const {
        values,
        loading,
        saving,
        error,
        editing,
        handleChange,
        handleSubmit,
        setValues
    } = useProductForm();

    const handleAIFill = async () => {
        if (!aiProductName.trim()) {
            return;
        }

        try {
            setAiLoading(true);

            const product = await generateProductWithAI(
                aiProductName.trim()
            );

            setValues(current => ({
                ...current,
                ...product
            }));
        } catch (error) {
            console.error('AI fill error:', error);
        } finally {
            setAiLoading(false);
        }
    };


    return (
        <section className="admin-page">

            <div className="admin-ai-product">
                <input
                    type="text"
                    placeholder="Enter product name"
                    value={aiProductName}
                    onChange={(e) => setAiProductName(e.target.value)}
                />

                <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleAIFill}
                    disabled={aiLoading}
                >
                    {aiLoading ? 'Finding product...' : '✨ Fill with AI'}
                </button>
            </div>

            <div className="admin-page-heading">
                <div>
                    <p className="admin-eyebrow">Catalog</p>
                    <h1>{editing ? 'Edit product' : 'Create product'}</h1>
                    <p>{editing ? 'Update the product details and save the changes.' : 'Add a product to the live catalog.'}</p>
                </div>
                <Link className="btn btn-outline" to="/admin/products">Cancel</Link>
            </div>
            {loading ? <div className="admin-state">Loading product...</div> : (
                <form className="admin-form" onSubmit={handleSubmit}>
                    <ProductFormFields values={values} onChange={setValues} />
                    <div className="admin-field admin-field-wide">
                        <span>Product image</span>
                        <ImageUpload imageUrl={values.imageUrl} productId={id} onUploaded={imageUrl => setValues(current => ({ ...current, imageUrl }))} />
                    </div>
                    {error && <div className="admin-alert">{error}</div>}
                    <div className="admin-form-actions">
                        <Link className="btn btn-outline" to="/admin/products">Cancel</Link>
                        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save changes' : 'Create product'}</button>
                    </div>
                </form>
            )}
        </section>
    );
}
