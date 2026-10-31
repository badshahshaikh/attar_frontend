import React from 'react';
import { useSeoSettings } from '../../features/seo/hooks/useSeoSettings';
import '../../styles/admin/shared/admin-shared.css';

const PAGE_TYPES = ['homepage', 'shop', 'category', 'product'];
const ROBOTS = ['index,follow', 'index,nofollow', 'noindex,follow', 'noindex,nofollow'];
const TWITTER_CARDS = ['summary', 'summary_large_image', 'app', 'player'];

export default function SeoSettings() {
    const {
        settings, loading, saving, error, success, editing, form, isCreating,
        showJsonEditor, jsonText, jsonError,
        startCreate, startEdit, cancelEdit, handleFieldChange, handleSave,
        handleDelete, handleJsonSave, setShowJsonEditor, setJsonText,
    } = useSeoSettings();

    if (loading && settings.length === 0 && !editing && !isCreating) {
        return <section className="admin-page"><div className="admin-state">Loading SEO settings...</div></section>;
    }

    const inForm = isCreating || !!editing;

    return (
        <section className="admin-page">
            <div className="admin-page-heading">
                <div>
                    <p className="admin-eyebrow">Website</p>
                    <h1>SEO Settings</h1>
                    <p>Manage per-route metadata, Open Graph, Twitter cards, and structured data.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {!inForm && <button className="btn btn-primary" onClick={startCreate}>New SEO Setting</button>}
                    {inForm && <button className="btn btn-outline" onClick={() => setShowJsonEditor(!showJsonEditor)}>{showJsonEditor ? 'Form Editor' : 'JSON Editor'}</button>}
                </div>
            </div>

            {error && <div className="admin-alert">{error}</div>}
            {success && <div className="admin-alert" style={{ backgroundColor: '#d4edda', color: '#155724' }}>{success}</div>}

            {!inForm ? (
                <div className="admin-form">
                    {settings.length === 0 ? (
                        <div className="admin-state">No SEO settings yet. Create one to get started.</div>
                    ) : (
                        <table className="admin-table">
                            <thead><tr><th>Route</th><th>Page Type</th><th>Title</th><th>Published</th><th>Actions</th></tr></thead>
                            <tbody>
                                {settings.map((s) => (
                                    <tr key={s.route_path}>
                                        <td>{s.route_path}</td>
                                        <td>{s.page_type}</td>
                                        <td>{s.seo_title || '-'}</td>
                                        <td>{s.is_published ? 'Yes' : 'No'}</td>
                                        <td>
                                            <button className="btn btn-outline" onClick={() => startEdit(s)}>Edit</button>
                                            <button className="btn btn-outline" style={{ marginLeft: 8 }} onClick={() => handleDelete(s.route_path)}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            ) : showJsonEditor ? (
                <div className="admin-form">
                    <div className="admin-field admin-field-wide">
                        <span>JSON Configuration</span>
                        <textarea className="admin-textarea" value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={20} style={{ fontFamily: 'monospace', fontSize: '14px' }} />
                        {jsonError && <div className="admin-alert">{jsonError}</div>}
                    </div>
                    <div className="admin-form-actions">
                        <button className="btn btn-outline" onClick={cancelEdit}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleJsonSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
                    </div>
                </div>
            ) : (
                <form className="admin-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    <div className="admin-section">
                        <h3>Basic</h3>
                        <div className="admin-field"><span>Page Type</span>
                            <select value={form.page_type || ''} onChange={(e) => handleFieldChange('page_type', e.target.value)}>{PAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                        <div className="admin-field"><span>Route Path</span>
                            <input type="text" value={form.route_path || ''} onChange={(e) => handleFieldChange('route_path', e.target.value)} placeholder="/shop" disabled={!isCreating} /></div>
                        <div className="admin-field"><label><input type="checkbox" checked={!!form.is_published} onChange={(e) => handleFieldChange('is_published', e.target.checked)} /><span>Published</span></label></div>
                        <div className="admin-field"><span>Product ID (optional)</span>
                            <input type="number" value={form.product_id ?? ''} onChange={(e) => handleFieldChange('product_id', e.target.value === '' ? null : Number(e.target.value))} /></div>
                    </div>
                    <div className="admin-section">
                        <h3>Meta</h3>
                        <div className="admin-field admin-field-wide"><span>SEO Title</span>
                            <input type="text" value={form.seo_title || ''} onChange={(e) => handleFieldChange('seo_title', e.target.value)} placeholder="Page title" /></div>
                        <div className="admin-field admin-field-wide"><span>Meta Description</span>
                            <textarea className="admin-textarea" rows={3} value={form.meta_description || ''} onChange={(e) => handleFieldChange('meta_description', e.target.value)} /></div>
                        <div className="admin-field admin-field-wide"><span>Canonical URL</span>
                            <input type="text" value={form.canonical_url || ''} onChange={(e) => handleFieldChange('canonical_url', e.target.value)} placeholder="https://..." /></div>
                        <div className="admin-field"><span>Robots</span>
                            <select value={form.robots || 'index,follow'} onChange={(e) => handleFieldChange('robots', e.target.value)}>{ROBOTS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                    </div>
                    <div className="admin-section">
                        <h3>Open Graph</h3>
                        <div className="admin-field admin-field-wide"><span>OG Title</span>
                            <input type="text" value={form.og_title || ''} onChange={(e) => handleFieldChange('og_title', e.target.value)} /></div>
                        <div className="admin-field admin-field-wide"><span>OG Description</span>
                            <textarea className="admin-textarea" rows={2} value={form.og_description || ''} onChange={(e) => handleFieldChange('og_description', e.target.value)} /></div>
                        <div className="admin-field admin-field-wide"><span>OG Image URL</span>
                            <input type="text" value={form.og_image || ''} onChange={(e) => handleFieldChange('og_image', e.target.value)} placeholder="https://..." /></div>
                    </div>
                    <div className="admin-section">
                        <h3>Twitter</h3>
                        <div className="admin-field"><span>Twitter Card</span>
                            <select value={form.twitter_card || 'summary_large_image'} onChange={(e) => handleFieldChange('twitter_card', e.target.value)}>{TWITTER_CARDS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                        <div className="admin-field admin-field-wide"><span>Twitter Title</span>
                            <input type="text" value={form.twitter_title || ''} onChange={(e) => handleFieldChange('twitter_title', e.target.value)} /></div>
                        <div className="admin-field admin-field-wide"><span>Twitter Description</span>
                            <textarea className="admin-textarea" rows={2} value={form.twitter_description || ''} onChange={(e) => handleFieldChange('twitter_description', e.target.value)} /></div>
                        <div className="admin-field admin-field-wide"><span>Twitter Image URL</span>
                            <input type="text" value={form.twitter_image || ''} onChange={(e) => handleFieldChange('twitter_image', e.target.value)} placeholder="https://..." /></div>
                    </div>
                    <div className="admin-section">
                        <h3>Structured Data (JSON)</h3>
                        <div className="admin-field admin-field-wide">
                            <span>JSON-LD Object</span>
                            <textarea className="admin-textarea" rows={8} style={{ fontFamily: 'monospace', fontSize: '13px' }}
                                value={typeof form.structured_data === 'string' ? form.structured_data : JSON.stringify(form.structured_data || {}, null, 2)}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    try { handleFieldChange('structured_data', JSON.parse(v)); }
                                    catch { handleFieldChange('structured_data', v); }
                                }} />
                        </div>
                    </div>
                    <div className="admin-form-actions">
                        <button type="button" className="btn btn-outline" onClick={cancelEdit}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : (isCreating ? 'Create' : 'Save Changes')}</button>
                    </div>
                </form>
            )}
        </section>
    );
}
