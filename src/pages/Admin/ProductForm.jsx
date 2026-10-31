import React, { useState, useEffect } from 'react';

import { Link, useParams } from 'react-router-dom';
import ProductFormFields from '../../components/admin/ProductFormFields';
import ImageUpload from '../../components/admin/ImageUpload';
import { useProductForm } from '../../features/products/hooks/useProductForm';
import '../../styles/admin/shared/admin-shared.css';
import { generateProductWithAI, generateProductImageWithAI } from '../../services/productService';

// D:\attar_frontend\src\components\admin\admin.css

export default function ProductForm() {

    const [aiProductName, setAiProductName] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiImage, setAiImage] = useState(null);
    const [aiImageLoading, setAiImageLoading] = useState(false);

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

    const handleAIImage = async () => {
        try {
            setAiImageLoading(true);

            const image = await generateProductImageWithAI({
                name: values.name,
                description: values.description,
                fragranceFamily: values.fragranceFamily || values.fragranceType,
                topNotes: values.topNotes,
                heartNotes: values.heartNotes,
                baseNotes: values.baseNotes
            });

            setAiImage(image);
        } catch (error) {
            console.error('AI image generation error:', error);
        } finally {
            setAiImageLoading(false);
        }
    };


    return (
        <section className="admin-page">



            <div className="admin-page-heading">
                <div>
                    <p className="admin-eyebrow">Catalog</p>
                    <h1>{editing ? 'Edit product' : 'Create product'}</h1>
                    <p>{editing ? 'Update the product details and save the changes.' : 'Add a product to the live catalog.'}</p>
                </div>
                <Link className="btn btn-outline" to="/admin/products">Cancel</Link>
            </div>

            <div className="admin-ai-product">
                <div className="admin-ai-product-content">
                    <div className="admin-ai-product-label">
                        <span className="admin-ai-icon">✦</span>
                        <div>
                            <strong>AI Product Assistant</strong>
                            <span>Enter a product name to automatically fill known details.</span>
                        </div>
                    </div>

                    <div className="admin-ai-product-input">
                        <input
                            type="text"
                            placeholder="e.g. Aseel Attar"
                            value={aiProductName}
                            onChange={(e) => setAiProductName(e.target.value)}
                        />

                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleAIFill}
                            disabled={aiLoading || !aiProductName.trim()}
                        >
                            {aiLoading ? 'Finding product...' : '✦ Fill with AI'}
                        </button>
                    </div>
                </div>
            </div>
            {loading ? <div className="admin-state">Loading product...</div> : (
                <form className="admin-form" onSubmit={(event) => handleSubmit(event, { pendingAiImage: aiImage })}>
                    <ProductFormFields values={values} onChange={setValues} />
                    <div className="admin-field admin-field-wide">
                        <span>Product image</span>
                        <div className="admin-field admin-field-wide">
                            <span>AI Product Image</span>

                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={handleAIImage}
                                disabled={aiImageLoading || !values.name}
                            >
                                {aiImageLoading ? 'Generating images...' : '✦ Generate with AI'}
                            </button>

                            {aiImage && (
                                <div className="admin-ai-image-previews">
                                    <div className="admin-ai-image-preview">
                                        <img
                                            src={`data:image/png;base64,${aiImage}`}
                                            alt="AI generated product"
                                            decoding="async"
                                        />
                                        <small>AI Generated Image</small>
                                    </div>
                                </div>
                            )}
                        </div>
                        <ImageUpload
                            imageUrl={values.imageUrl}
                            productId={id}
                            onUploaded={imageUrl => setValues(current => ({
                                ...current,
                                imageUrl,
                                // Keep the gallery in sync with the primary image
                                imageUrls: [imageUrl, ...(Array.isArray(current.imageUrls) ? current.imageUrls : [])]
                                    .filter((url, index, urls) => url && urls.indexOf(url) === index)
                            }))}
                        />
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
