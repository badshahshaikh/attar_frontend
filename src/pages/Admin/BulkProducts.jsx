import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchProducts, bulkUpsertProducts } from '../../services/productService';
import './BulkProducts.css';
import '../../components/admin/admin.css';
// ─── constants ────────────────────────────────────────────────────────────────
const SIZE_KEYS = ['3ml', '6ml', '12ml', '50ml', '100ml'];
const FRAGRANCE_FAMILIES = ['Oud', 'Musk', 'Amber', 'Shamama', 'Floral', 'French', 'Khas', 'Dehn Al Oud'];
const IMPORT_HEADERS = ['name', 'brand', 'fragranceType', '3ml', '6ml', '12ml', '50ml', '100ml'];

// ─── helpers ──────────────────────────────────────────────────────────────────
let _uid = 0;
function uid() { return `r${++_uid}`; }

// ─── catalog data hook ─────────────────────────────────────────────────────────
function useCatalogData() {
    const [brands, setBrands] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadCatalog = async () => {
            try {
                const [brandsRes, categoriesRes] = await Promise.all([
                    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/catalog/brands`),
                    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/catalog/categories`),
                ]);
                if (brandsRes.ok && categoriesRes.ok) {
                    setBrands(await brandsRes.json());
                    setCategories(await categoriesRes.json());
                }
            } catch (err) {
                console.error('Failed to load catalog data:', err);
            } finally {
                setLoading(false);
            }
        };
        loadCatalog();
    }, []);

    return { brands, categories, loading };
}

function buildSizePricing(row) {
    const sp = {};
    for (const s of SIZE_KEYS) {
        const v = parseFloat(row[`price_${s}`]);
        if (!isNaN(v) && v >= 0) sp[s] = v;
    }
    return sp;
}

function buildPayload(row) {
    const sp = buildSizePricing(row);
    const sizes = Object.keys(sp);
    const autoPrice = sizes.length > 0 ? Math.min(...Object.values(sp)) : undefined;
    const price = row.price !== '' && row.price !== undefined ? parseFloat(row.price) : autoPrice ?? '';
    const toArr = v => v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : [];
    return {
        name: row.name,
        brand: row.brand,
        fragranceType: row.fragranceType,
        category: row.category || 'Attar',
        price,
        originalPrice: row.originalPrice ? parseFloat(row.originalPrice) : null,
        sizePricing: sp,
        sizes,
        rating: row.rating !== '' ? parseFloat(row.rating) : 0,
        reviews: row.reviews !== '' ? parseInt(row.reviews, 10) : 0,
        stockQuantity: row.stockQuantity !== '' ? parseInt(row.stockQuantity, 10) : 0,
        inStock: row.inStock !== false,
        isNew: Boolean(row.isNew),
        isBestSeller: Boolean(row.isBestSeller),
        isExclusive: Boolean(row.isExclusive),
        featured: Boolean(row.featured),
        description: row.description || '',
        fullDescription: row.fullDescription || '',
        topNotes: toArr(row.topNotes),
        heartNotes: toArr(row.heartNotes),
        baseNotes: toArr(row.baseNotes),
        longevity: row.longevity || '',
        imageUrl: row.imageUrl || '',
        slug: row.slug || '',
    };
}

function validateRow(row) {
    const errs = [];
    if (!row.name || !String(row.name).trim()) errs.push('Product name required');
    if (!row.brand || !String(row.brand).trim()) errs.push('Brand required');
    if (!row.category || !String(row.category).trim()) errs.push('Category required');
    if (!row.fragranceType || !String(row.fragranceType).trim()) errs.push('Fragrance family required');
    const sp = buildSizePricing(row);
    const hasSizePrice = Object.keys(sp).length > 0;
    const manualPrice = row.price !== '' && row.price !== undefined ? parseFloat(row.price) : NaN;
    if (!hasSizePrice && isNaN(manualPrice)) errs.push('At least one size price or a main price is required');
    if (!hasSizePrice && !isNaN(manualPrice) && manualPrice < 0) errs.push('Price must be ≥ 0');
    if (row.rating !== '' && row.rating !== undefined) {
        const r = parseFloat(row.rating);
        if (isNaN(r) || r < 0 || r > 5) errs.push('Rating must be between 0 and 5');
    }
    if (row.stockQuantity !== '' && row.stockQuantity !== undefined) {
        const q = parseInt(row.stockQuantity, 10);
        if (!Number.isInteger(q) || q < 0) errs.push('Stock quantity must be a non-negative integer');
    }
    return errs;
}

function emptyRow(overrides = {}) {
    return {
        _uid: uid(), _origin: null, _originalSnapshot: null,
        id: null,
        name: '', brand: '', fragranceType: '', category: '',
        price: '', originalPrice: '',
        price_3ml: '', price_6ml: '', price_12ml: '', price_50ml: '', price_100ml: '',
        rating: '', reviews: '', stockQuantity: '', longevity: '',
        inStock: true, isNew: false, isBestSeller: false, isExclusive: false, featured: false,
        description: '', fullDescription: '',
        topNotes: '', heartNotes: '', baseNotes: '',
        imageUrl: '', slug: '',
        _errors: [], _showAdvanced: false,
        ...overrides,
    };
}

function rowFromProduct(p) {
    return emptyRow({
        _origin: 'db', id: p.id,
        name: p.name || '', brand: p.brand || '', fragranceType: p.fragranceType || '',
        category: p.category || '', price: '',
        originalPrice: p.originalPrice != null ? String(p.originalPrice) : '',
        price_3ml: p.sizePricing?.['3ml'] ?? '', price_6ml: p.sizePricing?.['6ml'] ?? '',
        price_12ml: p.sizePricing?.['12ml'] ?? '', price_50ml: p.sizePricing?.['50ml'] ?? '',
        price_100ml: p.sizePricing?.['100ml'] ?? '',
        rating: p.rating != null ? String(p.rating) : '',
        reviews: p.reviews != null ? String(p.reviews) : '',
        stockQuantity: p.stockQuantity != null ? String(p.stockQuantity) : '',
        longevity: p.longevity || '',
        inStock: p.inStock !== false, isNew: Boolean(p.isNew),
        isBestSeller: Boolean(p.isBestSeller), isExclusive: Boolean(p.isExclusive),
        featured: Boolean(p.featured),
        description: p.description || '', fullDescription: p.fullDescription || '',
        topNotes: Array.isArray(p.topNotes) ? p.topNotes.join(', ') : '',
        heartNotes: Array.isArray(p.heartNotes) ? p.heartNotes.join(', ') : '',
        baseNotes: Array.isArray(p.baseNotes) ? p.baseNotes.join(', ') : '',
        imageUrl: p.imageUrl || '', slug: p.slug || '',
        _originalSnapshot: null,
    });
}

function snapshotKey(row) {
    return JSON.stringify({
        name: row.name, brand: row.brand, fragranceType: row.fragranceType, category: row.category,
        price: row.price, originalPrice: row.originalPrice,
        price_3ml: row.price_3ml, price_6ml: row.price_6ml, price_12ml: row.price_12ml,
        price_50ml: row.price_50ml, price_100ml: row.price_100ml,
        rating: row.rating, reviews: row.reviews, stockQuantity: row.stockQuantity,
        inStock: row.inStock, isNew: row.isNew, isBestSeller: row.isBestSeller,
        isExclusive: row.isExclusive, featured: row.featured,
        description: row.description, fullDescription: row.fullDescription,
        topNotes: row.topNotes, heartNotes: row.heartNotes, baseNotes: row.baseNotes,
        longevity: row.longevity, imageUrl: row.imageUrl, slug: row.slug,
    });
}

function isModified(row) {
    if (!row._originalSnapshot || !row.id) return false;
    return snapshotKey(row) !== row._originalSnapshot;
}

function rowStatus(row) {
    if (!row.id) return 'new';
    if (isModified(row)) return 'modified';
    return 'unchanged';
}

// ─── parse pasted text ────────────────────────────────────────────────────────
function parsePastedText(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const rawHeaders = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/\s+/g, ''));
    const headerMap = {};
    rawHeaders.forEach((h, i) => {
        if (h === 'productname' || h === 'name') headerMap.name = i;
        else if (h === 'brand') headerMap.brand = i;
        else if (h === 'fragrancetype' || h === 'fragrancefamily' || h === 'type') headerMap.fragranceType = i;
        else if (h === '3ml') headerMap.price_3ml = i;
        else if (h === '6ml') headerMap.price_6ml = i;
        else if (h === '12ml') headerMap.price_12ml = i;
        else if (h === '50ml') headerMap.price_50ml = i;
        else if (h === '100ml') headerMap.price_100ml = i;
        else if (h === 'category') headerMap.category = i;
    });
    return lines.slice(1).map(line => {
        const cols = line.split(sep).map(c => c.trim());
        const r = emptyRow();
        for (const [field, idx] of Object.entries(headerMap)) {
            if (cols[idx] !== undefined) r[field] = cols[idx];
        }
        return r;
    }).filter(r => r.name);
}

// ─── sub-components ───────────────────────────────────────────────────────────

function CellInput({ value, onChange, type = 'text', placeholder = '', hasError = false, className = '' }) {
    return (
        <input
            type={type}
            className={`bulk-cell-input${hasError ? ' has-error' : ''}${className ? ` ${className}` : ''}`}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            step={type === 'number' ? 'any' : undefined}
            min={type === 'number' ? '0' : undefined}
        />
    );
}

function CellSelect({ value, onChange, options }) {
    return (
        <select className="bulk-cell-select" value={String(value)} onChange={e => onChange(e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value)}>
            {options.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
        </select>
    );
}

function RowBadge({ status }) {
    if (status === 'new') return <span className="row-badge row-badge-new">New</span>;
    if (status === 'modified') return <span className="row-badge row-badge-modified">Modified</span>;
    return <span className="row-badge row-badge-existing">Saved</span>;
}

function BulkRow({ row, index, onUpdate, onDelete, onDuplicate, brands, categories }) {
    const update = useCallback(
        (field, value) => onUpdate(row._uid, { [field]: value }),
        [onUpdate, row._uid]
    );
    const status = rowStatus(row);
    const hasErrors = row._errors && row._errors.length > 0;

    return (
        <>
            <tr className={`${status === 'new' ? 'bulk-row-new' : status === 'modified' ? 'bulk-row-dirty' : ''}${hasErrors ? ' bulk-row-error' : ''}`}>
                <td className="col-badge"><RowBadge status={status} /></td>

                <td className="col-name">
                    <CellInput value={row.name} onChange={v => update('name', v)} placeholder="Product name" hasError={hasErrors && !row.name} />
                </td>

                <td className="col-brand">
                    <CellSelect value={row.brand || ''} onChange={v => update('brand', v)}
                        options={[{ value: '', label: '—' }, ...brands.map(b => ({ value: b.name, label: b.name }))]}
                    />
                </td>

                <td className="col-cat">
                    <CellSelect value={row.category || ''} onChange={v => update('category', v)}
                        options={[{ value: '', label: '—' }, ...categories.map(c => ({ value: c.name, label: c.name }))]}
                    />
                </td>

                <td className="col-frag">
                    <CellSelect value={row.fragranceType || ''}
                        onChange={v => update('fragranceType', v)}
                        options={[{ value: '', label: '—' }, ...FRAGRANCE_FAMILIES.map(f => ({ value: f, label: f }))]}
                    />
                </td>

                {SIZE_KEYS.map(s => (
                    <td key={s} className="col-price">
                        <CellInput type="number" value={row[`price_${s}`]} onChange={v => update(`price_${s}`, v)} placeholder="—" />
                    </td>
                ))}

                <td className="col-rate">
                    <CellInput type="number" value={row.rating} onChange={v => update('rating', v)} placeholder="0" hasError={hasErrors && row._errors.some(e => e.includes('Rating'))} />
                </td>

                <td className="col-stock">
                    <CellInput type="number" value={row.stockQuantity} onChange={v => update('stockQuantity', v)} placeholder="0" />
                </td>

                <td className="col-bool">
                    <CellSelect value={row.inStock} onChange={v => update('inStock', v)}
                        options={[{ value: true, label: 'Yes' }, { value: false, label: 'No' }]} />
                </td>
                <td className="col-bool">
                    <CellSelect value={row.featured} onChange={v => update('featured', v)}
                        options={[{ value: false, label: 'No' }, { value: true, label: 'Yes' }]} />
                </td>
                <td className="col-bool">
                    <CellSelect value={row.isBestSeller} onChange={v => update('isBestSeller', v)}
                        options={[{ value: false, label: 'No' }, { value: true, label: 'Yes' }]} />
                </td>
                <td className="col-bool">
                    <CellSelect value={row.isNew} onChange={v => update('isNew', v)}
                        options={[{ value: false, label: 'No' }, { value: true, label: 'Yes' }]} />
                </td>

                <td className="col-act">
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-outline btn-small"
                            style={{ fontSize: '.65rem', padding: '4px 8px' }}
                            onClick={() => update('_showAdvanced', !row._showAdvanced)}
                            title="Toggle advanced details">
                            {row._showAdvanced ? '▲ Less' : '▼ More'}
                        </button>
                        <button type="button" className="btn btn-outline btn-small"
                            style={{ fontSize: '.65rem', padding: '4px 8px' }}
                            onClick={() => onDuplicate(row._uid)} title="Duplicate row">⧉</button>
                        <button type="button" className="btn btn-danger btn-small"
                            style={{ fontSize: '.65rem', padding: '4px 8px' }}
                            onClick={() => onDelete(row._uid)} title="Delete row">✕</button>
                    </div>
                </td>
            </tr>

            {hasErrors && (
                <tr>
                    <td colSpan={16} className="row-errors" style={{ paddingBottom: 6 }}>
                        {row._errors.map((e, i) => <span key={i} style={{ marginRight: 12 }}>❌ {e}</span>)}
                    </td>
                </tr>
            )}

            {row._showAdvanced && (
                <tr className="bulk-advanced-row">
                    <td colSpan={16}>
                        <div className="bulk-advanced-grid">
                            <label className="bulk-advanced-field">
                                <span>Short description</span>
                                <input value={row.description} onChange={e => update('description', e.target.value)} placeholder="Short description" />
                            </label>
                            <label className="bulk-advanced-field">
                                <span>Full description</span>
                                <input value={row.fullDescription} onChange={e => update('fullDescription', e.target.value)} placeholder="Full description" />
                            </label>
                            <label className="bulk-advanced-field">
                                <span>Top notes (comma-sep)</span>
                                <input value={row.topNotes} onChange={e => update('topNotes', e.target.value)} placeholder="Rose, Saffron" />
                            </label>
                            <label className="bulk-advanced-field">
                                <span>Heart notes</span>
                                <input value={row.heartNotes} onChange={e => update('heartNotes', e.target.value)} placeholder="Oud, Jasmine" />
                            </label>
                            <label className="bulk-advanced-field">
                                <span>Base notes</span>
                                <input value={row.baseNotes} onChange={e => update('baseNotes', e.target.value)} placeholder="Amber, Musk" />
                            </label>
                            <label className="bulk-advanced-field">
                                <span>Longevity</span>
                                <input value={row.longevity} onChange={e => update('longevity', e.target.value)} placeholder="8-10 Hours" />
                            </label>
                            <label className="bulk-advanced-field">
                                <span>Image URL</span>
                                <input value={row.imageUrl} onChange={e => update('imageUrl', e.target.value)} placeholder="https://..." />
                            </label>
                            <label className="bulk-advanced-field">
                                <span>Original price (Rs.)</span>
                                <input type="number" min="0" value={row.originalPrice} onChange={e => update('originalPrice', e.target.value)} placeholder="—" />
                            </label>
                            <label className="bulk-advanced-field">
                                <span>Reviews</span>
                                <input type="number" min="0" value={row.reviews} onChange={e => update('reviews', e.target.value)} placeholder="0" />
                            </label>
                            <label className="bulk-advanced-field">
                                <span>Exclusive</span>
                                <select value={String(row.isExclusive)} onChange={e => update('isExclusive', e.target.value === 'true')}>
                                    <option value="false">No</option><option value="true">Yes</option>
                                </select>
                            </label>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

// ─── ImportModal ──────────────────────────────────────────────────────────────
function ImportModal({ onClose, onImport }) {
    const [text, setText] = useState('');
    const [preview, setPreview] = useState([]);

    const handleParse = () => {
        const rows = parsePastedText(text);
        setPreview(rows);
    };

    return (
        <div className="bulk-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bulk-modal">
                <h2>Paste / Import Data</h2>
                <p style={{ fontSize: '.82rem', color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                    Paste CSV or tab-separated data from Excel. First row must be headers:<br />
                    <code style={{ fontSize: '.75rem' }}>{IMPORT_HEADERS.join(' | ')}</code>
                </p>
                <textarea className="import-textarea" value={text} onChange={e => setText(e.target.value)}
                    placeholder={'Product Name\tBrand\tFragrance Type\t3ml\t6ml\t12ml\n' +
                        'Amber Oud\tAnfar\tAmber\t180\t350\t650'} />

                {preview.length > 0 && (
                    <div className="import-preview-wrap">
                        <p style={{ fontSize: '.76rem', margin: '8px 0 4px', color: 'var(--color-text-secondary)' }}>
                            Preview — {preview.length} row(s) detected:
                        </p>
                        <table className="import-preview-table">
                            <thead><tr><th>Name</th><th>Brand</th><th>Type</th><th>3ml</th><th>6ml</th><th>12ml</th></tr></thead>
                            <tbody>{preview.slice(0, 8).map((r, i) => (
                                <tr key={i}>
                                    <td>{r.name}</td><td>{r.brand}</td><td>{r.fragranceType}</td>
                                    <td>{r.price_3ml}</td><td>{r.price_6ml}</td><td>{r.price_12ml}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                )}

                <div className="bulk-modal-actions" style={{ marginTop: 20 }}>
                    <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                    {preview.length === 0
                        ? <button type="button" className="btn btn-primary" onClick={handleParse}>Parse</button>
                        : <button type="button" className="btn btn-primary" onClick={() => { onImport(preview); onClose(); }}>
                            Add {preview.length} row(s)
                        </button>
                    }
                </div>
            </div>
        </div>
    );
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
function ConfirmModal({ stats, onConfirm, onCancel }) {
    return (
        <div className="bulk-modal-overlay">
            <div className="bulk-modal">
                <h2>Confirm Save</h2>
                <ul className="bulk-modal-list">
                    <li><span>Create new products</span><strong>{stats.toCreate}</strong></li>
                    <li><span>Update existing products</span><strong>{stats.toUpdate}</strong></li>
                    <li><span>Skip unchanged products</span><strong>{stats.unchanged}</strong></li>
                </ul>
                <p style={{ fontSize: '.82rem', color: 'var(--color-text-secondary)', marginBottom: 20 }}>
                    All changes run in a single database transaction. If anything fails, nothing will be saved.
                </p>
                <div className="bulk-modal-actions">
                    <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={onConfirm}>Confirm Save</button>
                </div>
            </div>
        </div>
    );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function BulkProducts() {
    const [rows, setRows] = useState(() => [emptyRow(), emptyRow(), emptyRow()]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [feedback, setFeedback] = useState({ type: '', message: '' });
    const tableRef = useRef(null);
    const { brands, categories, loading: catalogLoading } = useCatalogData();

    // ── row operations ──────────────────────────────────────────────────────
    const updateRow = useCallback((uid, patch) => {
        setRows(prev => prev.map(r => r._uid === uid ? { ...r, ...patch, _errors: [] } : r));
    }, []);

    const deleteRow = useCallback(uid => {
        setRows(prev => prev.filter(r => r._uid !== uid));
    }, []);

    const duplicateRow = useCallback(uid => {
        setRows(prev => {
            const idx = prev.findIndex(r => r._uid === uid);
            if (idx < 0) return prev;
            const copy = { ...prev[idx], _uid: uid(), id: null, _origin: null, _originalSnapshot: null, _errors: [] };
            const next = [...prev];
            next.splice(idx + 1, 0, copy);
            return next;
        });
    }, []);

    const addEmptyRows = (n = 1) => {
        setRows(prev => [...prev, ...Array.from({ length: n }, () => emptyRow())]);
        setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
    };

    const clearAll = () => {
        if (!window.confirm('Clear all rows? This cannot be undone.')) return;
        setRows([emptyRow()]);
        setFeedback({ type: '', message: '' });
    };

    const resetChanges = () => {
        setRows(prev => prev.map(r => {
            if (!r._originalSnapshot) return r;
            try {
                const snap = JSON.parse(r._originalSnapshot);
                return { ...r, ...snap, _errors: [] };
            } catch { return r; }
        }));
    };

    // ── load existing products ──────────────────────────────────────────────
    const loadExisting = async () => {
        setLoadingProducts(true);
        setFeedback({ type: '', message: '' });
        try {
            const result = await fetchProducts({ limit: 200 });
            const products = result.products || result;
            const loaded = products.map(p => {
                const r = rowFromProduct(p);
                r._originalSnapshot = snapshotKey(r);
                return r;
            });
            setRows(loaded);
        } catch {
            setFeedback({ type: 'error', message: 'Failed to load products from the API.' });
        } finally {
            setLoadingProducts(false);
        }
    };

    // ── import ──────────────────────────────────────────────────────────────
    const handleImport = useCallback(importedRows => {
        setRows(prev => [...prev, ...importedRows]);
    }, []);

    // ── validate all ────────────────────────────────────────────────────────
    const validateAll = () => {
        let anyError = false;
        const next = rows.map(row => {
            const errors = validateRow(row);
            if (errors.length) anyError = true;
            return { ...row, _errors: errors };
        });
        setRows(next);
        return !anyError;
    };

    // ── save ────────────────────────────────────────────────────────────────
    const handleSaveClick = () => {
        if (!validateAll()) {
            setFeedback({ type: 'error', message: 'Please fix the highlighted errors before saving.' });
            return;
        }
        setShowConfirm(true);
        setFeedback({ type: '', message: '' });
    };

    const confirmSave = async () => {
        setShowConfirm(false);
        setSaving(true);
        setFeedback({ type: '', message: '' });

        const toCreate = rows.filter(r => !r.id && rowStatus(r) === 'new');
        const toUpdate = rows.filter(r => r.id && rowStatus(r) === 'modified');

        try {
            const result = await bulkUpsertProducts({
                create: toCreate.map(buildPayload),
                update: toUpdate.map(r => ({ id: r.id, ...buildPayload(r) })),
            });

            if (!result.success) {
                // Map server-side validation errors back to rows
                const next = [...rows];
                for (const err of result.errors || []) {
                    if (err.context === 'create' && toCreate[err.row - 1]) {
                        const idx = next.findIndex(r => r._uid === toCreate[err.row - 1]._uid);
                        if (idx >= 0) next[idx] = { ...next[idx], _errors: [...(next[idx]._errors || []), err.message] };
                    }
                }
                setRows(next);
                setFeedback({ type: 'error', message: 'Validation failed on the server. See highlighted rows.' });
                return;
            }

            // Update local state so saved rows become "unchanged"
            const createdProducts = result.products?.slice(0, result.created) || [];
            const updatedProducts = result.products?.slice(result.created) || [];

            setRows(prev => {
                const next = [...prev];
                let ci = 0, ui = 0;
                return next.map(row => {
                    const status = rowStatus(row);
                    if (status === 'new' && !row.id && ci < createdProducts.length) {
                        const loaded = rowFromProduct(createdProducts[ci++]);
                        loaded._originalSnapshot = snapshotKey(loaded);
                        return loaded;
                    }
                    if (status === 'modified' && row.id && ui < updatedProducts.length) {
                        const updated = rowFromProduct(updatedProducts[ui++]);
                        updated._originalSnapshot = snapshotKey(updated);
                        return updated;
                    }
                    if (status === 'unchanged') {
                        return row;
                    }
                    return row;
                });
            });

            setFeedback({
                type: 'success',
                message: `✓ Successfully created ${result.created} product(s) and updated ${result.updated} product(s).`,
            });
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Failed to save products. No database changes were made.' });
        } finally {
            setSaving(false);
        }
    };

    // ── derived stats ───────────────────────────────────────────────────────
    const stats = rows.reduce((acc, r) => {
        const s = rowStatus(r);
        if (s === 'new') acc.toCreate++;
        else if (s === 'modified') acc.toUpdate++;
        else acc.unchanged++;
        if (r._errors && r._errors.length > 0) acc.invalid++;
        return acc;
    }, { toCreate: 0, toUpdate: 0, unchanged: 0, invalid: 0 });

    return (
        <>
            <section className="bulk-page">
                {/* page heading */}
                <div className="admin-page-heading">
                    <div>
                        <p className="admin-eyebrow">Catalog</p>
                        <h1>Bulk Product Management</h1>
                        <p>Edit multiple products in a spreadsheet-style interface. Changes are only saved when you click "Save All".</p>
                    </div>
                    <Link className="btn btn-outline" to="/admin/products">← Back to Products</Link>
                </div>

                {/* sticky stats + actions bar */}
                <div className="bulk-bar">
                    <div className="bulk-bar-stats">
                        <span className="bulk-stat">Total rows: <strong>{rows.length}</strong></span>
                        <span className="bulk-stat">New: <strong>{stats.toCreate}</strong></span>
                        <span className="bulk-stat">Modified: <strong>{stats.toUpdate}</strong></span>
                        <span className="bulk-stat">Unchanged: <strong>{stats.unchanged}</strong></span>
                        {stats.invalid > 0 && (
                            <span className="bulk-stat has-errors">Invalid: <strong>{stats.invalid}</strong></span>
                        )}
                    </div>
                    <div className="bulk-bar-actions">
                        <button type="button" className="btn btn-outline btn-small" onClick={() => validateAll()}>Validate</button>
                        <button type="button" className="btn btn-outline btn-small" onClick={resetChanges}>Reset Changes</button>
                        <button type="button" className="btn btn-outline btn-small" onClick={clearAll}>Clear All</button>
                        <button type="button" className="btn btn-primary" onClick={handleSaveClick} disabled={saving}>
                            {saving ? 'Saving…' : 'Save All Changes'}
                        </button>
                    </div>
                </div>

                {/* feedback */}
                {feedback.type === 'success' && <div className="bulk-success">{feedback.message}</div>}
                {feedback.type === 'error' && <div className="bulk-error-banner">{feedback.message}</div>}

                {/* toolbar */}
                <div className="bulk-toolbar">
                    <button type="button" className="btn btn-outline btn-small" onClick={() => addEmptyRows(1)}>+ Add Row</button>
                    <button type="button" className="btn btn-outline btn-small" onClick={() => addEmptyRows(5)}>+ Add 5 Rows</button>
                    <button type="button" className="btn btn-outline btn-small" onClick={() => setShowImport(true)}>⬇ Paste Data</button>
                    <button type="button" className="btn btn-outline btn-small" onClick={loadExisting} disabled={loadingProducts}>
                        {loadingProducts ? 'Loading…' : '☁ Load Existing Products'}
                    </button>
                </div>

                {/* table */}
                <div className="bulk-table-wrap" ref={tableRef}>
                    <table className="bulk-table">
                        <thead>
                            <tr>
                                <th className="col-badge">Status</th>
                                <th className="col-name">Product Name *</th>
                                <th className="col-brand">Brand *</th>
                                <th className="col-cat">Category</th>
                                <th className="col-frag">Fragrance *</th>
                                {SIZE_KEYS.map(s => <th key={s} className="col-price">{s}</th>)}
                                <th className="col-rate">Rating</th>
                                <th className="col-stock">Stock</th>
                                <th className="col-bool">In Stock</th>
                                <th className="col-bool">Featured</th>
                                <th className="col-bool">Best Seller</th>
                                <th className="col-bool">New</th>
                                <th className="col-act">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={16} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                                        No rows. Click "+ Add Row" or "Load Existing Products".
                                    </td>
                                </tr>
                            ) : rows.map((row, index) => (
                                <BulkRow
                                    key={row._uid}
                                    row={row}
                                    index={index}
                                    onUpdate={updateRow}
                                    onDelete={deleteRow}
                                    onDuplicate={duplicateRow}
                                    brands={brands}
                                    categories={categories}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* bottom add row */}
                <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                    <button type="button" className="btn btn-outline btn-small" onClick={() => addEmptyRows(1)}>+ Add Row</button>
                    <button type="button" className="btn btn-outline btn-small" onClick={() => addEmptyRows(10)}>+ Add 10 Rows</button>
                </div>
            </section>

            {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={handleImport} />}
            {showConfirm && (
                <ConfirmModal
                    stats={stats}
                    onConfirm={confirmSave}
                    onCancel={() => setShowConfirm(false)}
                />
            )}
        </>
    );
}
