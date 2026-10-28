import { useState, useEffect, useCallback } from 'react';
import {
    listSeoSettings,
    getSeoSetting,
    createSeoSetting,
    updateSeoSetting,
    deleteSeoSetting,
} from '../../../services/seoService';
import { DEFAULT_SEO_SETTINGS } from '../constants/defaultSeoSettings';
import { validateSeoSettings } from '../validators/seoValidator';

export function useSeoSettings() {
    const [settings, setSettings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ ...DEFAULT_SEO_SETTINGS });
    const [isCreating, setIsCreating] = useState(false);
    const [showJsonEditor, setShowJsonEditor] = useState(false);
    const [jsonText, setJsonText] = useState('');
    const [jsonError, setJsonError] = useState('');

    const loadSettings = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const data = await listSeoSettings();
            setSettings(Array.isArray(data) ? data : (data.settings || data.items || []));
        } catch (err) {
            setError(err.message || 'Failed to load SEO settings');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadSettings(); }, [loadSettings]);

    const startCreate = () => {
        setIsCreating(true);
        setEditing(null);
        setForm({ ...DEFAULT_SEO_SETTINGS });
        setJsonText(JSON.stringify(DEFAULT_SEO_SETTINGS, null, 2));
        setError(''); setSuccess('');
    };

    const startEdit = async (record) => {
        try {
            setLoading(true);
            const full = await getSeoSetting(record.route_path);
            setEditing(full);
            setIsCreating(false);
            const merged = { ...DEFAULT_SEO_SETTINGS, ...full };
            if (typeof merged.structured_data === 'string') {
                try { merged.structured_data = JSON.parse(merged.structured_data); } catch { merged.structured_data = {}; }
            }
            setForm(merged);
            setJsonText(JSON.stringify(merged, null, 2));
            setError(''); setSuccess('');
        } catch (err) {
            setError(err.message || 'Failed to load SEO setting');
        } finally {
            setLoading(false);
        }
    };

    const cancelEdit = () => {
        setEditing(null);
        setIsCreating(false);
        setForm({ ...DEFAULT_SEO_SETTINGS });
        setError(''); setSuccess('');
        setShowJsonEditor(false);
    };

    const handleFieldChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        const errors = validateSeoSettings(form, { isUpdate: !isCreating });
        if (errors.length > 0) { setError(errors.join(', ')); setSuccess(''); return; }
        const payload = { ...form };
        if (payload.route_path) payload.route_path = String(payload.route_path).trim();
        setSaving(true); setError(''); setSuccess('');
        try {
            if (isCreating) {
                await createSeoSetting(payload);
                setSuccess('SEO setting created successfully!');
            } else if (editing) {
                await updateSeoSetting(editing.route_path, payload);
                setSuccess('SEO setting updated successfully!');
            }
            await loadSettings();
            cancelEdit();
        } catch (err) {
            const msg = err.details ? `${err.message}: ${JSON.stringify(err.details)}` : (err.message || 'Failed to save SEO setting');
            setError(msg);
        } finally {
            setSaving(false);
        }
    };
    const handleDelete = async (route) => {
        if (!window.confirm(`Delete SEO setting for ${route}?`)) return;
        setSaving(true); setError(''); setSuccess('');
        try {
            await deleteSeoSetting(route);
            setSuccess('SEO setting deleted.');
            await loadSettings();
            if (editing && editing.route_path === route) cancelEdit();
        } catch (err) {
            setError(err.message || 'Failed to delete SEO setting');
        } finally {
            setSaving(false);
        }
    };

    const handleJsonSave = async () => {
        setJsonError('');
        try {
            const parsed = JSON.parse(jsonText);
            setForm(parsed);
            const errors = validateSeoSettings(parsed, { isUpdate: !isCreating });
            if (errors.length > 0) { setJsonError(errors.join(', ')); return; }
            setSaving(true);
            if (isCreating) {
                await createSeoSetting(parsed);
            } else if (editing) {
                await updateSeoSetting(editing.route_path, parsed);
            }
            setSuccess('SEO setting saved successfully!');
            setShowJsonEditor(false);
            await loadSettings();
            cancelEdit();
        } catch (err) {
            setJsonError(err.message ? `Invalid JSON or save failed: ${err.message}` : 'Invalid JSON format');
        } finally {
            setSaving(false);
        }
    };

    return {
        settings, loading, saving, error, success, editing, form, isCreating,
        showJsonEditor, jsonText, jsonError,
        loadSettings, startCreate, startEdit, cancelEdit, handleFieldChange,
        handleSave, handleDelete, handleJsonSave, setShowJsonEditor, setJsonText,
    };
}
