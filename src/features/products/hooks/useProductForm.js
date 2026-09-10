import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createProduct, fetchProductById, updateProduct } from '../../../services/productService';
import { EMPTY_PRODUCT } from '../constants/productConstants';
import { productToForm, formToProductPayload } from '../utils/productHelpers';
import { validateProductForm } from '../validators/productValidator';

/**
 * useProductForm - Custom hook for product form business logic
 * 
 * Separates form state, validation, and submission logic from UI.
 * Makes the logic reusable and testable.
 */

export function useProductForm() {
    const { id } = useParams();
    const editing = Boolean(id);
    const navigate = useNavigate();
    
    const [values, setValues] = useState(EMPTY_PRODUCT);
    const [loading, setLoading] = useState(editing);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Load product data if editing
    useEffect(() => {
        if (!editing) return;
        
        fetchProductById(id)
            .then(product => setValues(productToForm(product, EMPTY_PRODUCT)))
            .catch(loadError => {
                setError(loadError.status === 404 ? 'Product not found.' : 'Unable to load this product.');
            })
            .finally(() => setLoading(false));
    }, [id, editing]);

    const handleChange = (field, value) => {
        setValues(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        // Validate form
        const validation = validateProductForm(values);
        if (!validation.isValid) {
            setError(Object.values(validation.errors).join(', '));
            return;
        }

        // Parse size pricing JSON
        let sizePricing;
        try {
            sizePricing = values.sizePricing.trim() ? JSON.parse(values.sizePricing) : {};
        } catch {
            setError('Size pricing must be valid JSON, for example {"3ml":199}.');
            return;
        }

        setSaving(true);
        try {
            const payload = formToProductPayload({ ...values, sizePricing });
            
            if (editing) {
                await updateProduct(id, payload);
            } else {
                await createProduct(payload);
            }
            
            navigate('/admin/products');
        } catch (saveError) {
            setError(
                saveError.status === 401 ? 'Your session has expired. Please sign in again.' :
                saveError.status === 400 ? saveError.message :
                'Unable to save product. Please check the form and try again.'
            );
        } finally {
            setSaving(false);
        }
    };

    return {
        // State
        values,
        loading,
        saving,
        error,
        editing,
        
        // Actions
        handleChange,
        handleSubmit,
        setValues
    };
}
