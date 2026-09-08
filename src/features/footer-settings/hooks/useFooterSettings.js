import { useState, useEffect } from 'react';
import { getFooterSettings, updateFooterSettings } from '../../../services/footerSettingsService';
import { DEFAULT_FOOTER_SETTINGS } from '../constants/defaultFooterSettings';
import { validateFooterSettings } from '../validators/footerSettingsValidator';

/**
 * useFooterSettings - Custom hook for footer settings business logic
 * 
 * Separates business logic from UI components.
 * Handles state management, API calls, and validation.
 * 
 * This makes the logic:
 * - Reusable across components
 * - Testable without UI
 * - Easier to maintain
 */

export function useFooterSettings() {
    const [settings, setSettings] = useState(DEFAULT_FOOTER_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showJsonEditor, setShowJsonEditor] = useState(false);
    const [jsonText, setJsonText] = useState('');
    const [jsonError, setJsonError] = useState('');

    // Load settings on mount
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const data = await getFooterSettings();
            setSettings(data);
            setJsonText(JSON.stringify(data, null, 2));
        } catch (err) {
            setError('Failed to load footer settings');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (section, field, value) => {
        setSettings(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
    };

    const handleToggleChange = (section, field) => {
        setSettings(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: !prev[section][field]
            }
        }));
    };

    const handleSave = async () => {
        const errors = validateFooterSettings(settings);
        if (errors.length > 0) {
            setError(errors.join(', '));
            setSuccess('');
            return;
        }

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            await updateFooterSettings(settings);
            setSuccess('Footer settings updated successfully!');
            setJsonText(JSON.stringify(settings, null, 2));
        } catch (err) {
            setError(err.message || 'Failed to update footer settings');
        } finally {
            setSaving(false);
        }
    };

    const handleJsonSave = async () => {
        setJsonError('');
        try {
            const parsed = JSON.parse(jsonText);
            setSettings(parsed);
            setSaving(true);
            await updateFooterSettings(parsed);
            setSuccess('Footer settings updated successfully!');
            setShowJsonEditor(false);
        } catch (err) {
            setJsonError('Invalid JSON format: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        loadSettings();
        setError('');
        setSuccess('');
        setShowJsonEditor(false);
    };

    return {
        // State
        settings,
        loading,
        saving,
        error,
        success,
        showJsonEditor,
        jsonText,
        jsonError,
        
        // Actions
        loadSettings,
        handleInputChange,
        handleToggleChange,
        handleSave,
        handleJsonSave,
        handleCancel,
        setShowJsonEditor,
        setJsonText
    };
}
