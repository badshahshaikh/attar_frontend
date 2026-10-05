import React, { useEffect, useState } from 'react';
import {
    fetchAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
} from '../../services/customerService';

const EMPTY_FORM = {
    label: '',
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    isDefault: false,
};

const Field = ({ id, label, required, ...rest }) => (
    <div className="form-group">
        <label htmlFor={id} className="form-label">
            {label}
            {required && <span className="field-required"> *</span>}
        </label>
        <input id={id} className="form-input" required={required} {...rest} />
    </div>
);

const AddressBook = () => {
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState('');
    const [formError, setFormError] = useState('');
    const [notice, setNotice] = useState('');

    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);
    const [formOpen, setFormOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const rows = await fetchAddresses();
                if (!cancelled) setAddresses(rows);
            } catch (error) {
                if (!cancelled) setListError(error.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const setField = (name, value) => {
        setForm((previous) => ({ ...previous, [name]: value }));
    };

    const openAdd = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setFormError('');
        setFormOpen(true);
    };

    const openEdit = (address) => {
        setEditingId(address.id);
        setForm({
            label: address.label || '',
            fullName: address.fullName || '',
            phone: address.phone || '',
            line1: address.line1 || '',
            line2: address.line2 || '',
            city: address.city || '',
            state: address.state || '',
            postalCode: address.postalCode || '',
            country: address.country || 'India',
            isDefault: Boolean(address.isDefault),
        });
        setFormError('');
        setFormOpen(true);
    };

    const closeForm = () => {
        setFormOpen(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        setFormError('');
    };


    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError('');
        setNotice('');
        setSaving(true);

        const payload = {
            ...form,
            label: form.label.trim() || null,
            line2: form.line2.trim() || null,
            country: form.country.trim() || 'India',
        };

        try {
            if (editingId) {
                await updateAddress(editingId, payload);
                setNotice('Address updated.');
            } else {
                await createAddress(payload);
                setNotice('Address saved.');
            }

            setAddresses(await fetchAddresses());
            closeForm();
        } catch (error) {
            setFormError(error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (address) => {
        if (!window.confirm(`Delete "${address.label || address.fullName}"?`)) return;

        setBusyId(address.id);
        setFormError('');
        setNotice('');

        try {
            setAddresses(await deleteAddress(address.id));
            setNotice('Address deleted.');
        } catch (error) {
            setFormError(error.message);
        } finally {
            setBusyId(null);
        }
    };

    const handleSetDefault = async (address) => {
        setBusyId(address.id);
        setFormError('');
        setNotice('');

        try {
            setAddresses(await setDefaultAddress(address.id));
            setNotice(`"${address.label || address.fullName}" is now your default address.`);
        } catch (error) {
            setFormError(error.message);
        } finally {
            setBusyId(null);
        }
    };

    if (loading) {
        return <p className="account-empty">Loading your addresses…</p>;
    }

    return (
        <section className="account-card">
            <div className="account-card-head">
                <h2>Addresses</h2>
                {!formOpen && (
                    <button type="button" className="btn btn-outline account-head-action" onClick={openAdd}>
                        + ADD NEW
                    </button>
                )}
            </div>

            {listError && <div className="auth-error">{listError}</div>}
            {formError && <div className="auth-error">{formError}</div>}
            {notice && <div className="auth-success">{notice}</div>}

            {formOpen && (
                <form className="auth-form address-form" onSubmit={handleSubmit}>
                    <div className="address-form-grid">

                        <Field
                            id="addrLabel"
                            label="Label"
                            value={form.label}
                            onChange={(e) => setField('label', e.target.value)}
                            placeholder="Home, Work…"
                            maxLength={50}
                            disabled={saving}
                        />

                        <Field
                            id="addrCountry"
                            label="Country"
                            value={form.country}
                            onChange={(e) => setField('country', e.target.value)}
                            maxLength={50}
                            disabled={saving}
                        />

                        <Field
                            id="addrFullName"
                            label="Full name"
                            required
                            type="text"
                            value={form.fullName}
                            onChange={(e) => setField('fullName', e.target.value)}
                            autoComplete="name"
                            maxLength={200}
                            disabled={saving}
                        />

                        <Field
                            id="addrPhone"
                            label="Phone number"
                            required
                            type="tel"
                            value={form.phone}
                            onChange={(e) => setField('phone', e.target.value)}
                            autoComplete="tel"
                            pattern="[6-9][0-9]{9}"
                            title="Enter a valid 10-digit mobile number"
                            disabled={saving}
                        />

                        <div className="address-form-full">
                            <Field
                                id="addrLine1"
                                label="Address line 1"
                                required
                                type="text"
                                value={form.line1}
                                onChange={(e) => setField('line1', e.target.value)}
                                autoComplete="address-line1"
                                maxLength={200}
                                disabled={saving}
                            />
                        </div>

                        <div className="address-form-full">
                            <Field
                                id="addrLine2"
                                label="Address line 2"
                                type="text"
                                value={form.line2}
                                onChange={(e) => setField('line2', e.target.value)}
                                autoComplete="address-line2"
                                maxLength={200}
                                disabled={saving}
                            />
                        </div>

                        <Field
                            id="addrCity"
                            label="City"
                            required
                            type="text"
                            value={form.city}
                            onChange={(e) => setField('city', e.target.value)}
                            autoComplete="address-level2"
                            maxLength={200}
                            disabled={saving}
                        />

                        <Field
                            id="addrState"
                            label="State"
                            required
                            type="text"
                            value={form.state}
                            onChange={(e) => setField('state', e.target.value)}
                            autoComplete="address-level1"
                            maxLength={200}
                            disabled={saving}
                        />

                        <Field
                            id="addrPostalCode"
                            label="PIN code"
                            required
                            type="text"
                            inputMode="numeric"
                            value={form.postalCode}
                            onChange={(e) => setField('postalCode', e.target.value)}
                            autoComplete="postal-code"
                            pattern="[0-9]{6}"
                            title="Enter a valid 6-digit PIN code"
                            disabled={saving}
                        />
                    </div>

                    <label className="address-default-toggle">
                        <input
                            type="checkbox"
                            checked={form.isDefault}
                            onChange={(e) => setField('isDefault', e.target.checked)}
                            disabled={saving}
                        />
                        <span>Use this as my default address</span>
                    </label>

                    <div className="address-form-actions">
                        <button type="submit" className="btn auth-button" disabled={saving}>
                            {saving ? 'SAVING…' : editingId ? 'UPDATE ADDRESS' : 'SAVE ADDRESS'}
                        </button>
                        <button type="button" className="btn btn-outline" onClick={closeForm} disabled={saving}>
                            CANCEL
                        </button>
                    </div>
                </form>
            )}


            {!formOpen && addresses.length === 0 && (
                <p className="account-empty">
                    You have not saved an address yet. Add one so checkout takes a single tap.
                </p>
            )}

            {!formOpen && addresses.length > 0 && (
                <ul className="address-list">
                    {addresses.map((address) => (
                        <li key={address.id} className={`address-item${address.isDefault ? ' is-default' : ''}`}>
                            <div className="address-item-head">
                                <span className="address-item-label">
                                    {address.label || address.fullName}
                                </span>
                                {address.isDefault && <span className="address-badge">DEFAULT</span>}
                            </div>

                            <p className="address-item-body">
                                {address.fullName}<br />
                                {address.line1}
                                {address.line2 ? <>, {address.line2}</> : null}<br />
                                {address.city}, {address.state} {address.postalCode}<br />
                                {address.country}
                                {address.phone ? <><br />{address.phone}</> : null}
                            </p>

                            <div className="address-item-actions">
                                {!address.isDefault && (
                                    <button
                                        type="button"
                                        className="link-button"
                                        onClick={() => handleSetDefault(address)}
                                        disabled={busyId === address.id}
                                    >
                                        Set default
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="link-button"
                                    onClick={() => openEdit(address)}
                                    disabled={busyId === address.id}
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    className="link-button link-button--danger"
                                    onClick={() => handleDelete(address)}
                                    disabled={busyId === address.id}
                                >
                                    {busyId === address.id ? 'Working…' : 'Delete'}
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

export default AddressBook;
