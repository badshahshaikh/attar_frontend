import React from 'react';
import { useFooterSettings } from '../../features/footer-settings/hooks/useFooterSettings';
import '../../styles/admin/shared/admin-shared.css';

export default function FooterSettings() {
    const {
        settings,
        loading,
        saving,
        error,
        success,
        showJsonEditor,
        jsonText,
        jsonError,
        handleInputChange,
        handleToggleChange,
        handleSave,
        handleJsonSave,
        handleCancel,
        setShowJsonEditor,
        setJsonText
    } = useFooterSettings();

    if (loading) {
        return (
            <section className="admin-page">
                <div className="admin-state">Loading footer settings...</div>
            </section>
        );
    }

    return (
        <section className="admin-page">
            <div className="admin-page-heading">
                <div>
                    <p className="admin-eyebrow">Website</p>
                    <h1>Footer Settings</h1>
                    <p>Manage your website footer content and contact information.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        className="btn btn-outline"
                        onClick={() => setShowJsonEditor(!showJsonEditor)}
                    >
                        {showJsonEditor ? 'Form Editor' : 'JSON Editor'}
                    </button>
                </div>
            </div>

            {error && <div className="admin-alert">{error}</div>}
            {success && <div className="admin-alert" style={{ backgroundColor: '#d4edda', color: '#155724' }}>{success}</div>}

            {showJsonEditor ? (
                <div className="admin-form">
                    <div className="admin-field admin-field-wide">
                        <span>JSON Configuration</span>
                        <textarea
                            className="admin-textarea"
                            value={jsonText}
                            onChange={(e) => setJsonText(e.target.value)}
                            rows={20}
                            style={{ fontFamily: 'monospace', fontSize: '14px' }}
                        />
                        {jsonError && <div className="admin-alert">{jsonError}</div>}
                    </div>
                    <div className="admin-form-actions">
                        <button className="btn btn-outline" onClick={handleCancel}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleJsonSave} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            ) : (
                <form className="admin-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    {/* Brand Information */}
                    <div className="admin-section">
                        <h3>Brand Information</h3>
                        <div className="admin-field">
                            <span>Brand Name</span>
                            <input
                                type="text"
                                value={settings.brand.name}
                                onChange={(e) => handleInputChange('brand', 'name', e.target.value)}
                                placeholder="MS Fragrance"
                            />
                        </div>
                        <div className="admin-field admin-field-wide">
                            <span>Brand Description</span>
                            <textarea
                                className="admin-textarea"
                                value={settings.brand.description}
                                onChange={(e) => handleInputChange('brand', 'description', e.target.value)}
                                rows={3}
                                placeholder="Your brand description"
                            />
                        </div>
                        <div className="admin-field">
                            <span>Logo URL</span>
                            <input
                                type="text"
                                value={settings.brand.logo}
                                onChange={(e) => handleInputChange('brand', 'logo', e.target.value)}
                                placeholder="https://..."
                            />
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div className="admin-section">
                        <h3>Contact Information</h3>
                        <div className="admin-field">
                            <span>Email</span>
                            <input
                                type="email"
                                value={settings.contact.email}
                                onChange={(e) => handleInputChange('contact', 'email', e.target.value)}
                                placeholder="example@email.com"
                            />
                        </div>
                        <div className="admin-field">
                            <span>Phone</span>
                            <input
                                type="text"
                                value={settings.contact.phone}
                                onChange={(e) => handleInputChange('contact', 'phone', e.target.value)}
                                placeholder="+91 XXXXX XXXXX"
                            />
                        </div>
                        <div className="admin-field">
                            <span>WhatsApp</span>
                            <input
                                type="text"
                                value={settings.contact.whatsapp}
                                onChange={(e) => handleInputChange('contact', 'whatsapp', e.target.value)}
                                placeholder="+91 XXXXX XXXXX"
                            />
                        </div>
                        <div className="admin-field admin-field-wide">
                            <span>Address</span>
                            <textarea
                                className="admin-textarea"
                                value={settings.contact.address}
                                onChange={(e) => handleInputChange('contact', 'address', e.target.value)}
                                rows={2}
                                placeholder="Your business address"
                            />
                        </div>
                    </div>

                    {/* Social Media */}
                    <div className="admin-section">
                        <h3>Social Media</h3>
                        <div className="admin-field">
                            <span>Instagram URL</span>
                            <input
                                type="text"
                                value={settings.socialMedia.instagram}
                                onChange={(e) => handleInputChange('socialMedia', 'instagram', e.target.value)}
                                placeholder="https://instagram.com/..."
                            />
                        </div>
                        <div className="admin-field">
                            <span>Facebook URL</span>
                            <input
                                type="text"
                                value={settings.socialMedia.facebook}
                                onChange={(e) => handleInputChange('socialMedia', 'facebook', e.target.value)}
                                placeholder="https://facebook.com/..."
                            />
                        </div>
                        <div className="admin-field">
                            <span>YouTube URL</span>
                            <input
                                type="text"
                                value={settings.socialMedia.youtube}
                                onChange={(e) => handleInputChange('socialMedia', 'youtube', e.target.value)}
                                placeholder="https://youtube.com/..."
                            />
                        </div>
                        <div className="admin-field">
                            <span>Twitter/X URL</span>
                            <input
                                type="text"
                                value={settings.socialMedia.twitter}
                                onChange={(e) => handleInputChange('socialMedia', 'twitter', e.target.value)}
                                placeholder="https://twitter.com/..."
                            />
                        </div>
                    </div>

                    {/* Footer Links */}
                    <div className="admin-section">
                        <h3>Footer Links</h3>
                        <div className="admin-field">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.links.shop}
                                    onChange={() => handleToggleChange('links', 'shop')}
                                />
                                <span>Show Shop Link</span>
                            </label>
                        </div>
                        <div className="admin-field">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.links.about}
                                    onChange={() => handleToggleChange('links', 'about')}
                                />
                                <span>Show About Link</span>
                            </label>
                        </div>
                        <div className="admin-field">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.links.collections}
                                    onChange={() => handleToggleChange('links', 'collections')}
                                />
                                <span>Show Collections Link</span>
                            </label>
                        </div>
                        <div className="admin-field">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.links.contact}
                                    onChange={() => handleToggleChange('links', 'contact')}
                                />
                                <span>Show Contact Link</span>
                            </label>
                        </div>
                    </div>

                    {/* Newsletter */}
                    <div className="admin-section">
                        <h3>Newsletter</h3>
                        <div className="admin-field">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.newsletter.enabled}
                                    onChange={() => handleToggleChange('newsletter', 'enabled')}
                                />
                                <span>Enable Newsletter</span>
                            </label>
                        </div>
                        <div className="admin-field">
                            <span>Newsletter Title</span>
                            <input
                                type="text"
                                value={settings.newsletter.title}
                                onChange={(e) => handleInputChange('newsletter', 'title', e.target.value)}
                                placeholder="Stay Updated"
                            />
                        </div>
                        <div className="admin-field admin-field-wide">
                            <span>Newsletter Description</span>
                            <textarea
                                className="admin-textarea"
                                value={settings.newsletter.description}
                                onChange={(e) => handleInputChange('newsletter', 'description', e.target.value)}
                                rows={2}
                                placeholder="Subscribe to receive updates and exclusive offers."
                            />
                        </div>
                    </div>

                    {/* Copyright */}
                    <div className="admin-section">
                        <h3>Copyright</h3>
                        <div className="admin-field admin-field-wide">
                            <span>Copyright Text</span>
                            <input
                                type="text"
                                value={settings.copyright.text}
                                onChange={(e) => handleInputChange('copyright', 'text', e.target.value)}
                                placeholder="© 2026 MS Fragrance. All rights reserved."
                            />
                        </div>
                    </div>

                    <div className="admin-form-actions">
                        <button type="button" className="btn btn-outline" onClick={handleCancel}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            )}
        </section>
    );
}
