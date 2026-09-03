import React from 'react';

const textFields = [
    ['name', 'Product name', true], ['brand', 'Brand', true], ['fragranceType', 'Fragrance family', true],
    ['longevity', 'Longevity'], ['description', 'Short description'], ['fullDescription', 'Full description'],
];

export default function ProductFormFields({ values, onChange }) {
    const update = (name, value) => onChange({ ...values, [name]: value });
    return (
        <div className="admin-form-grid">
            {textFields.map(([name, label, required]) => (
                <label key={name} className={name.includes('Description') ? 'admin-field admin-field-wide' : 'admin-field'}>
                    <span>{label}{required ? ' *' : ''}</span>
                    {name.includes('Description') ? <textarea rows={name === 'fullDescription' ? 5 : 3} value={values[name]} onChange={event => update(name, event.target.value)} required={required} /> : <input value={values[name]} onChange={event => update(name, event.target.value)} required={required} />}
                </label>
            ))}
            <label className="admin-field"><span>Category</span><select value={values.category} onChange={event => update('category', event.target.value)}><option>Attar</option><option>Perfume</option><option>Essential Oil</option><option>Other</option></select></label>
            <label className="admin-field"><span>Price (Rs.) *</span><input type="number" min="0" step="0.01" value={values.price} onChange={event => update('price', event.target.value)} required /></label>
            <label className="admin-field"><span>Original price (Rs.)</span><input type="number" min="0" step="0.01" value={values.originalPrice} onChange={event => update('originalPrice', event.target.value)} /></label>
            <label className="admin-field"><span>Stock quantity</span><input type="number" min="0" step="1" value={values.stockQuantity} onChange={event => update('stockQuantity', event.target.value)} /></label>
            <label className="admin-field"><span>Rating</span><input type="number" min="0" max="5" step="0.1" value={values.rating} onChange={event => update('rating', event.target.value)} /></label>
            <label className="admin-field"><span>Review count</span><input type="number" min="0" step="1" value={values.reviews} onChange={event => update('reviews', event.target.value)} /></label>
            <label className="admin-field admin-field-wide"><span>Available sizes</span><input value={values.sizes} onChange={event => update('sizes', event.target.value)} placeholder="3ml, 6ml, 12ml" /></label>
            <label className="admin-field admin-field-wide"><span>Size pricing JSON</span><input value={values.sizePricing} onChange={event => update('sizePricing', event.target.value)} placeholder='{"3ml": 199}' /></label>
            <label className="admin-field admin-field-wide"><span>Top notes</span><input value={values.topNotes} onChange={event => update('topNotes', event.target.value)} placeholder="Rose, Saffron" /></label>
            <label className="admin-field admin-field-wide"><span>Heart notes</span><input value={values.heartNotes} onChange={event => update('heartNotes', event.target.value)} /></label>
            <label className="admin-field admin-field-wide"><span>Base notes</span><input value={values.baseNotes} onChange={event => update('baseNotes', event.target.value)} /></label>
            {['inStock', 'isNew', 'isBestSeller', 'isExclusive', 'featured'].map(name => (
                <label className="admin-field" key={name}><span>{name === 'inStock' ? 'In stock' : name.replace('is', 'Is ')}</span><select value={String(values[name])} onChange={event => update(name, event.target.value === 'true')}><option value="true">Yes</option><option value="false">No</option></select></label>
            ))}
        </div>
    );
}
