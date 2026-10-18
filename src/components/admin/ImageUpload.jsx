import React, { useRef, useState } from 'react';
import { uploadProductImage } from '../../services/productService';

export default function ImageUpload({ imageUrl, productId, onUploaded }) {
    const inputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = async event => {
        const file = event.target.files[0];
        if (!file) return;
        setError('');
        setUploading(true);
        try {
            const data = await uploadProductImage(file, productId);
            onUploaded(data.imageUrl);
        } catch (uploadError) {
            setError(uploadError.status === 401 ? 'Your session has expired. Please sign in again.' : uploadError.message);
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    return (
        <div className="admin-image-upload">
            {imageUrl ? <img src={imageUrl} alt="Product preview" decoding="async" /> : <div className="admin-image-empty">No image selected</div>}
            <div><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} disabled={uploading} /><small>{uploading ? 'Uploading...' : 'JPEG, PNG or WebP, max 5MB'}</small>{error && <p className="admin-error">{error}</p>}</div>
        </div>
    );
}
