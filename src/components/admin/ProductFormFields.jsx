import React from 'react';

const textFields = [
    ['name', 'Product name', true],
    ['brand', 'Brand', true],
    ['fragranceType', 'Fragrance family', true],
    ['longevity', 'Longevity'],
    ['description', 'Short description'],
    ['fullDescription', 'Full description'],
];

export default function ProductFormFields({ values, onChange }) {
    const update = (name, value) => {
        onChange({
            ...values,
            [name]: value,
        });
    };

    /*
     * Size pricing is kept in the form as:
     *
     * [
     *   { size: '3ml', price: '180' },
     *   { size: '6ml', price: '350' }
     * ]
     *
     * formToProductPayload() can convert this into the existing
     * backend format:
     *
     * {
     *   "3ml": 180,
     *   "6ml": 350
     * }
     */

    const sizePricing = Array.isArray(values.sizePricing)
        ? values.sizePricing
        : [];

    const addSizePricing = () => {
        update('sizePricing', [
            ...sizePricing,
            {
                size: '',
                price: '',
            },
        ]);
    };

    const updateSizePricing = (index, field, value) => {
        const updated = sizePricing.map((item, itemIndex) =>
            itemIndex === index
                ? {
                    ...item,
                    [field]: value,
                }
                : item
        );

        update('sizePricing', updated);
    };

    const removeSizePricing = (index) => {
        update(
            'sizePricing',
            sizePricing.filter((_, itemIndex) => itemIndex !== index)
        );
    };

    return (
        <div className="admin-form-grid">
            {textFields.map(([name, label, required]) => {
                const isDescription =
                    name === 'description' ||
                    name === 'fullDescription';

                return (
                    <label
                        key={name}
                        className={
                            isDescription
                                ? 'admin-field admin-field-wide'
                                : 'admin-field'
                        }
                    >
                        <span>
                            {label}
                            {required ? ' *' : ''}
                        </span>

                        {isDescription ? (
                            <textarea
                                rows={name === 'fullDescription' ? 5 : 3}
                                value={values[name] || ''}
                                onChange={(event) =>
                                    update(name, event.target.value)
                                }
                                required={required}
                            />
                        ) : (
                            <input
                                value={values[name] || ''}
                                onChange={(event) =>
                                    update(name, event.target.value)
                                }
                                required={required}
                            />
                        )}
                    </label>
                );
            })}

            {/* Category */}
            <label className="admin-field">
                <span>Category</span>

                <select
                    value={values.category || 'Attar'}
                    onChange={(event) =>
                        update('category', event.target.value)
                    }
                >
                    <option value="Attar">Attar</option>
                    <option value="Perfume">Perfume</option>
                    <option value="Essential Oil">Essential Oil</option>
                    <option value="Other">Other</option>
                </select>
            </label>

            {/* Price */}
            <label className="admin-field">
                <span>Price (Rs.) *</span>

                <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={values.price ?? ''}
                    onChange={(event) =>
                        update('price', event.target.value)
                    }
                    required
                />
            </label>

            {/* Original Price */}
            <label className="admin-field">
                <span>Original price (Rs.)</span>

                <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={values.originalPrice ?? ''}
                    onChange={(event) =>
                        update('originalPrice', event.target.value)
                    }
                />
            </label>

            {/* Stock */}
            <label className="admin-field">
                <span>Stock quantity</span>

                <input
                    type="number"
                    min="0"
                    step="1"
                    value={values.stockQuantity ?? ''}
                    onChange={(event) =>
                        update('stockQuantity', event.target.value)
                    }
                />
            </label>

            {/* Rating */}
            <label className="admin-field">
                <span>Rating</span>

                <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={values.rating ?? ''}
                    onChange={(event) =>
                        update('rating', event.target.value)
                    }
                />
            </label>

            {/* Reviews */}
            <label className="admin-field">
                <span>Review count</span>

                <input
                    type="number"
                    min="0"
                    step="1"
                    value={values.reviews ?? ''}
                    onChange={(event) =>
                        update('reviews', event.target.value)
                    }
                />
            </label>

            {/* =====================================================
                SIZE & PRICING
            ====================================================== */}
            <div className="admin-field admin-field-wide">
                <div className="admin-field-header">
                    <span>Available Sizes & Pricing</span>

                    <button
                        type="button"
                        className="admin-add-button"
                        onClick={addSizePricing}
                    >
                        + Add Size
                    </button>
                </div>

                {sizePricing.length === 0 ? (
                    <div className="admin-empty-field">
                        No sizes added yet.
                    </div>
                ) : (
                    <div className="size-pricing-list">
                        {sizePricing.map((item, index) => (
                            <div className="size-pricing-row" key={index}>
                                <div className="size-input-wrapper">
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={item.size || ''}
                                        placeholder="3"
                                        onChange={(event) =>
                                            updateSizePricing(
                                                index,
                                                'size',
                                                event.target.value
                                            )
                                        }
                                    />
                                    <span className="size-unit">ml</span>
                                </div>

                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.price ?? ''}
                                    placeholder="Price (Rs.)"
                                    onChange={(event) =>
                                        updateSizePricing(
                                            index,
                                            'price',
                                            event.target.value
                                        )
                                    }
                                />

                                <button
                                    type="button"
                                    className="admin-remove-button"
                                    onClick={() => removeSizePricing(index)}
                                    aria-label={`Remove size ${item.size || index + 1}`}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Top Notes */}
            <label className="admin-field admin-field-wide">
                <span>Top notes</span>

                <input
                    value={values.topNotes || ''}
                    onChange={(event) =>
                        update('topNotes', event.target.value)
                    }
                    placeholder="Rose, Saffron"
                />
            </label>

            {/* Heart Notes */}
            <label className="admin-field admin-field-wide">
                <span>Heart notes</span>

                <input
                    value={values.heartNotes || ''}
                    onChange={(event) =>
                        update('heartNotes', event.target.value)
                    }
                    placeholder="Jasmine, Oud"
                />
            </label>

            {/* Base Notes */}
            <label className="admin-field admin-field-wide">
                <span>Base notes</span>

                <input
                    value={values.baseNotes || ''}
                    onChange={(event) =>
                        update('baseNotes', event.target.value)
                    }
                    placeholder="Musk, Amber"
                />
            </label>

            {/* Product Status */}
            {[
                'inStock',
                'isNew',
                'isBestSeller',
                'isExclusive',
                'featured',
            ].map((name) => (
                <label className="admin-field" key={name}>
                    <span>
                        {name === 'inStock'
                            ? 'In stock'
                            : name.replace('is', 'Is ')}
                    </span>

                    <select
                        value={String(values[name])}
                        onChange={(event) =>
                            update(
                                name,
                                event.target.value === 'true'
                            )
                        }
                    >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                    </select>
                </label>
            ))}
        </div>
    );
}