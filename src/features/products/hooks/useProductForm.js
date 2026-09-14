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


        setSaving(true);
        try {
            const payload = formToProductPayload(values);
            console.log('=== PRODUCT SAVE DEBUG ===');
            console.log('Form sizePricing:', values.sizePricing);
            console.log('Final sizePricing:', payload.sizePricing);
            console.log('Full payload:', payload);
            console.log('==========================');
            if (editing) {
                await updateProduct(id, payload);
            } else {
                await createProduct(payload);
            }

            navigate('/admin/products');
        } catch (saveError) {
            console.error('PRODUCT SAVE ERROR:', saveError);
            console.error('Status:', saveError?.status);
            console.error('Message:', saveError?.message);


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
