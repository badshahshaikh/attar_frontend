import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, ArrowLeft, CircleCheck, CreditCard } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { fetchAddresses, createOrder, createGuestOrder, verifyPayment } from '../../services/customerService';
import { openRazorpayCheckout } from '../../services/paymentRazorpay';
import { buildWhatsAppUrl, buildGuestOrderMessage } from '../../features/checkout/utils/orderMessage';
import { validateGuestCheckout } from '../../features/checkout/validators/guestCheckoutValidator';
import './Checkout.css';

/**
 * Checkout — reviews the basket and hands it over to WhatsApp.
 *
 * Signed-in customers AND guests both record the order server-side first
 * (POST /api/customer/orders or /orders/guest — prices/shipping are computed
 * from the products table, never trusted from the client) and the WhatsApp
 * message then carries the real order number. Guests are not required to sign
 * in: clicking "Proceed with WhatsApp" opens a short delivery form, which is
 * validated on the client and the server before the order is saved.
 */
const Checkout = () => {
    const { state, cartSubtotal, dispatch } = useCart();
    const { items } = state;
    const { user, loading: authLoading } = useCustomerAuth();

    // `ownerId` records whose addresses are in `rows` so a stale basket from a
    // previous session is never shown under a different signed-in customer.
    const [addressBook, setAddressBook] = useState({ ownerId: null, rows: [] });
    const [addressId, setAddressId] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [placedOrder, setPlacedOrder] = useState(null);
    const [whatsappUrl, setWhatsappUrl] = useState('');
    const [paying, setPaying] = useState(false);

    // Guest delivery form. Opened by "Proceed with WhatsApp" for shoppers with
    // no account; the saved order (source of truth) drives the WhatsApp message.
    const [guestFormOpen, setGuestFormOpen] = useState(false);
    const [guestForm, setGuestForm] = useState({
        fullName: '',
        phone: '',
        addressLine: '',
        addressLine2: '',
        city: '',
        state: '',
        postalCode: '',
        email: '',
    });
    const [guestErrors, setGuestErrors] = useState({});

    // Refs mirror the in-flight flags synchronously. State updates are async,
    // so without these two rapid clicks could both pass the `saving`/`paying`
    // checks and fire duplicate createOrder calls (duplicate orders + double
    // stock deduction). Refs flip immediately and close that race window.
    const placingRef = useRef(false);
    const payingRef = useRef(false);

    // Load saved addresses for signed-in customers so checkout is one tap.
    // All setState calls happen in the promise callback, never synchronously.
    useEffect(() => {
        if (!user) return undefined;

        let cancelled = false;
        fetchAddresses()
            .then((rows) => {
                if (cancelled) return;
                setAddressBook({ ownerId: user.id, rows });
                const preferred = rows.find((row) => row.isDefault) || rows[0];
                setAddressId(preferred ? String(preferred.id) : '');
            })
            .catch(() => {
                // Saved addresses are a convenience — checkout still works
                // with the contact details on the profile.
            });

        return () => {
            cancelled = true;
        };
    }, [user]);

    const addresses = user && addressBook.ownerId === user.id ? addressBook.rows : [];

    const shippingCharge = cartSubtotal > 5000 ? 0 : 150;
    const finalTotal = cartSubtotal + shippingCharge;

    // `buildWhatsAppUrl` is imported from features/checkout/utils/orderMessage.

    // WhatsApp must open synchronously inside the click handler. Browsers
    // block `window.open` calls that happen after an `await` (the user-gesture
    // context is lost), so we open a blank tab up-front and navigate it to
    // the real URL once the order exists. If the popup is blocked entirely,
    // `window.open` returns null and the stored URL keeps the on-page
    // "Continue on WhatsApp" link working as a fallback.
    function openWhatsAppTab() {
        try {
            const tab = window.open('about:blank', '_blank');

            if (tab) {
                tab.opener = null;
            }

            return tab;
        } catch {
            return null;
        }
    }

    const navigateTab = (tab, message) => {
        const url = buildWhatsAppUrl(message);
        if (tab && !tab.closed) {
            tab.location.href = url;
        } else {
            window.open(url, '_blank');
        }
        return url;
    };

    // The order message is always built from the *server* response so the
    // totals, delivery details and order number in the chat can never drift
    // from what was actually recorded — for guests and signed-in customers
    // alike (both now persist an order before opening WhatsApp).
    const buildOrderMessage = (order) => buildGuestOrderMessage(order);

    // Opens the guest delivery form so the shopper can enter their details.
    const openGuestForm = () => {
        setError('');
        setGuestErrors({});
        setGuestFormOpen(true);
    };

    const closeGuestForm = () => {
        // Never yank the form out from under an in-flight submission.
        if (saving) return;
        setGuestFormOpen(false);
        setGuestErrors({});
    };

    const updateGuestField = (field) => (event) => {
        const { value } = event.target;
        setGuestForm((prev) => ({ ...prev, [field]: value }));
        // Clear this field's error as soon as the shopper edits it.
        setGuestErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    // Guest checkout submit: validate on the client, save the order server-side
    // (which re-prices everything and reserves stock), then open WhatsApp with
    // the saved order and show the success screen — the same order flow as a
    // signed-in customer, just without an account.
    const handleGuestSubmit = async (event) => {
        event.preventDefault();
        setError('');

        const { valid, errors, values } = validateGuestCheckout(guestForm);
        setGuestErrors(errors);

        if (!valid) {
            return;
        }

        // Ref guard closes the double-click race (state is async); the button is
        // also disabled while `saving`. This is what stops a double-submit from
        // creating two orders and deducting stock twice.
        if (placingRef.current) return;
        placingRef.current = true;

        // Open the tab synchronously inside the submit gesture so the browser
        // does not block the popup; navigated to the order URL once it exists.
        const tab = openWhatsAppTab();

        setSaving(true);
        try {
            const order = await createGuestOrder({
                fullName: values.fullName,
                phone: values.phone,
                addressLine: values.addressLine,
                addressLine2: values.addressLine2 || undefined,
                city: values.city,
                state: values.state || undefined,
                postalCode: values.postalCode,
                email: values.email || undefined,
                source: 'web',
                items: items.map((item) => ({
                    productId: item.productId,
                    size: item.size,
                    quantity: item.quantity,
                })),
            });

            setPlacedOrder(order);
            setWhatsappUrl(navigateTab(tab, buildGuestOrderMessage(order)));
            setGuestFormOpen(false);
            // Clear the basket only after the server confirms the order.
            dispatch({ type: 'CLEAR_CART' });
        } catch (err) {
            if (tab && !tab.closed) tab.close();
            setError(err.message || 'We could not place your order. Please try again.');
        } finally {
            setSaving(false);
            placingRef.current = false;
        }
    };

    // Single shared order-creation path used by both checkout buttons, so the
    // payload (and the one server-side stock deduction) can never diverge
    // between the WhatsApp flow and the Pay-Online flow.
    const placeOrderOnce = () => createOrder({
        // Only trust the picker when it belongs to the current customer;
        // otherwise fall through to the profile contact details.
        addressId: addresses.length > 0 && addressId ? Number(addressId) : null,
        // Without a saved address the server requires contact details,
        // so fall back to what is on the profile.
        contactName: user.fullName || undefined,
        contactPhone: user.phone || undefined,
        source: 'web',
        items: items.map((item) => ({
            productId: item.productId,
            size: item.size,
            quantity: item.quantity,
        })),
    });

    const handlePlaceOrder = async () => {
        setError('');

        // Guest: collect delivery details first. Nothing is recorded and no tab
        // opens until the form is submitted, so the popup stays tied to the
        // submit gesture inside handleGuestSubmit.
        if (!user) {
            openGuestForm();
            return;
        }

        // Ref guard closes the double-click race (state is async); the button
        // is also disabled while `saving` for normally-paced clicks. Also
        // refuse while a Razorpay popup is in flight (`payingRef`) — the
        // order already exists server-side, so placing again here would
        // create a duplicate order and deduct stock a second time.
        if (placingRef.current || payingRef.current) return;
        placingRef.current = true;

        // Open the tab synchronously in the click handler so the browser keeps
        // the user-gesture context; it is navigated to the order URL below.
        const tab = openWhatsAppTab();

        setSaving(true);
        try {
            const order = await placeOrderOnce();

            setPlacedOrder(order);
            setWhatsappUrl(navigateTab(tab, buildOrderMessage(order)));
            // Only clear after the server confirms — a failed request keeps
            // the basket so the customer can retry without losing anything.
            dispatch({ type: 'CLEAR_CART' });
        } catch (err) {
            // Order creation failed: close the pre-opened blank tab so the
            // customer is not left staring at an empty page, then surface
            // the server message (e.g. insufficient stock).
            if (tab && !tab.closed) tab.close();
            setError(err.message || 'We could not place your order. Please try again.');
        } finally {
            setSaving(false);
            placingRef.current = false;
        }
    };

    const handlePayOnline = async () => {
        setError('');

        if (!user) return;
        // Either flag means an order or payment is already in flight.
        if (placingRef.current || payingRef.current) return;

        let order = placedOrder;

        // Place the order first if it hasn't been placed yet. Stock is
        // deducted exactly once inside this create() call; payment
        // verification and webhooks only flip payment_status (markPaid),
        // so retries below can never deduct stock again.
        if (!order) {
            placingRef.current = true;
            setSaving(true);
            try {
                order = await placeOrderOnce();
                setPlacedOrder(order);
                setWhatsappUrl(buildWhatsAppUrl(buildOrderMessage(order)));
                dispatch({ type: 'CLEAR_CART' });
            } catch (err) {
                setError(err.message || 'Could not place your order.');
                return;
            } finally {
                setSaving(false);
                placingRef.current = false;
            }
        }

        if (!order) return;

        // The order now exists server-side, so Razorpay init failing here is
        // safe: the customer retries payment against the SAME order (no new
        // order, no second deduction) via the button or the success screen.
        payingRef.current = true;
        setPaying(true);
        // Capture the order number up-front: `order` is a render-local binding
        // and a re-render mid-payment could otherwise leave the closure with
        // a stale value when the proof finally arrives.
        const payingOrderNumber = order.orderNumber;
        try {
            await openRazorpayCheckout({
                orderNumber: payingOrderNumber,
                customer: user,
                onSuccess: async (proof) => {
                    try {
                        const paid = await verifyPayment(payingOrderNumber, proof);

                        setPlacedOrder(paid);
                        setError('');
                    } catch (verifyErr) {
                        setError(
                            verifyErr.message ||
                            'Payment may have succeeded, but verification failed. Please check your order status before trying again.'
                        );

                        // Important: let the payment handler know verification failed.
                        throw verifyErr;
                    }
                }
            });
        } catch (err) {
            if (err?.code === 'PAYMENT_DISMISSED') {
                // Customer closed the payment window.
                setError('');
            } else if (err?.code === 'PAYMENT_FAILED') {
                setError(
                    err.message || 'Payment failed. Please try again.'
                );
            } else {
                setError(
                    err?.message ||
                    'Unable to complete payment. Check your order status before retrying.'
                );
            }
        } finally {
            setPaying(false);
            payingRef.current = false;
        }
    };

    if (placedOrder) {
        return (
            <main className="checkout-page container empty-checkout-container">
                <div className="empty-checkout-content checkout-success-content">
                    <CircleCheck size={48} className="checkout-success-icon" />
                    <h2>Order {placedOrder.orderNumber} placed</h2>
                    <p>
                        {placedOrder.paymentStatus === 'paid'
                            ? 'Your payment has been received. We will confirm the order shortly.'
                            : user
                                ? 'Your order has been saved to your account. You can pay online below or continue on WhatsApp.'
                                : 'Your order has been saved. Continue on WhatsApp so we can confirm availability and delivery details.'}
                    </p>
                    <div className="checkout-success-actions">
                        {placedOrder.paymentStatus !== 'paid' && (
                            <div className="online-payment-coming-soon">
                                <CreditCard size={20} />
                                <span>Online Payment — Coming Soon</span>
                            </div>
                        )}

                        {whatsappUrl && (
                            <a
                                className="btn btn-whatsapp btn-lg"
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <MessageCircle size={20} />
                                {placedOrder.paymentStatus === 'paid'
                                    ? 'Open WhatsApp'
                                    : 'Continue on WhatsApp'}
                            </a>
                        )}

                        {/* Order history lives behind the account, so guests (who
                            have no account) skip this and just continue shopping. */}
                        {user && (
                            <Link to="/account" className="btn btn-primary btn-lg">
                                View my orders
                            </Link>
                        )}
                    </div>
                    <Link to="/shop" className="checkout-success-continue">
                        <ArrowLeft size={16} /> Continue shopping
                    </Link>
                </div>
            </main>
        );
    }

    if (items.length === 0) {
        return (
            <div className="checkout-page container empty-checkout-container">
                <div className="empty-checkout-content">
                    <h2>Your Cart is Empty</h2>
                    <p>Please add items to your cart before proceeding to checkout.</p>
                    <Link to="/" className="btn btn-primary btn-lg continue-shopping-btn">
                        <ArrowLeft size={18} /> Back to Shop
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <main className="checkout-page container">
            <h1 className="page-title">Order Review</h1>

            <div className="checkout-layout">
                <div className="checkout-items-section">
                    <h3>Review Your Items</h3>
                    <div className="checkout-items-list">
                        {items.map((item, index) => (
                            <div key={`${item.productId}-${item.size}-${index}`} className="checkout-item">
                                <div className="checkout-item-image">
                                    <img src={item.image || "https://images.unsplash.com/photo-1594035987173-1e5b2cc22bc0?q=80&w=300&auto=format&fit=crop"} alt={item.name} />
                                </div>
                                <div className="checkout-item-details">
                                    <h4 className="checkout-item-name">{item.name}</h4>
                                    <span className="checkout-item-size">Size: {item.size}</span>
                                </div>
                                <div className="checkout-item-qty">
                                    Qty: {item.quantity}
                                </div>
                                <div className="checkout-item-price">
                                    <div className="unit-price">₹{item.price.toLocaleString()} each</div>
                                    <div className="item-total">₹{item.total.toLocaleString()}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="checkout-summary-section">
                    <div className="checkout-summary-card">
                        <h3>Order Summary</h3>

                        <div className="summary-row">
                            <span>Subtotal</span>
                            <span>₹{cartSubtotal.toLocaleString()}</span>
                        </div>

                        <div className="summary-row">
                            <span>Shipping</span>
                            <span>{shippingCharge === 0 ? 'To be confirmed' : `₹${shippingCharge.toLocaleString()}`}</span>
                        </div>

                        <div className="summary-divider"></div>

                        <div className="summary-row total-row">
                            <span>Final Total</span>
                            <span>₹{finalTotal.toLocaleString()}</span>
                        </div>

                        {user && (
                            <div className="checkout-delivery">
                                <label className="checkout-delivery-label" htmlFor="checkoutAddress">
                                    Deliver to
                                </label>
                                {addresses.length > 0 ? (
                                    <select
                                        id="checkoutAddress"
                                        className="checkout-address-select"
                                        value={addressId}
                                        onChange={(event) => setAddressId(event.target.value)}
                                    >
                                        {addresses.map((address) => (
                                            <option key={address.id} value={String(address.id)}>
                                                {address.label ? `${address.label} — ` : ''}
                                                {address.fullName}, {address.city || address.line1}
                                                {address.isDefault ? ' (default)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="checkout-delivery-hint">
                                        We will use the contact details on your profile.{' '}
                                        <Link to="/account">Add a saved address</Link> for faster
                                        checkout next time.
                                    </p>
                                )}
                            </div>
                        )}

                        {error && <div className="checkout-error">{error}</div>}

                        <div className="whatsapp-checkout-action">
                            <button
                                className="btn btn-whatsapp btn-lg w-100"
                                onClick={handlePlaceOrder}
                                disabled={saving || authLoading}
                            >
                                <MessageCircle size={20} />
                                {saving ? 'Placing your order…' : 'Proceed with WhatsApp'}
                            </button>
                            <p className="whatsapp-help-text">
                                {user
                                    ? 'Your order is recorded in your account, then confirmed with us on WhatsApp.'
                                    : 'Enter your delivery details and we will confirm your order on WhatsApp. No account needed.'}
                            </p>
                            {!user && (
                                <p className="whatsapp-help-text">
                                    <Link to="/login">Sign in</Link> to save this order to your
                                    account.
                                </p>
                            )}
                            <div className="online-payment-coming-soon">
                                <CreditCard size={20} />
                                <span>Online Payment — Coming Soon</span>
                            </div>
                            <p className="whatsapp-help-text">
                                Online payments will be available soon. For now, please
                                place your order through WhatsApp.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Guest delivery form — opened by "Proceed with WhatsApp". Keeps the
                basket and summary untouched behind it; the order is only saved
                when this form is submitted. */}
            {!user && guestFormOpen && (
                <div className="guest-checkout-overlay" role="dialog" aria-modal="true" aria-label="Delivery details">
                    <div className="guest-checkout-modal">
                        <div className="guest-checkout-header">
                            <h3>Delivery Details</h3>
                            <button
                                type="button"
                                className="guest-checkout-close"
                                onClick={closeGuestForm}
                                disabled={saving}
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>

                        <p className="guest-checkout-intro">
                            Enter your details so we can confirm your order on WhatsApp. No account is needed.
                        </p>

                        <form className="guest-checkout-form" onSubmit={handleGuestSubmit} noValidate>
                            <div className="guest-checkout-field">
                                <label htmlFor="guest-fullName">Full name *</label>
                                <input
                                    id="guest-fullName"
                                    name="fullName"
                                    type="text"
                                    autoComplete="name"
                                    value={guestForm.fullName}
                                    onChange={updateGuestField('fullName')}
                                    disabled={saving}
                                />
                                {guestErrors.fullName && <span className="guest-field-error">{guestErrors.fullName}</span>}
                            </div>

                            <div className="guest-checkout-field">
                                <label htmlFor="guest-phone">Mobile number *</label>
                                <input
                                    id="guest-phone"
                                    name="phone"
                                    type="tel"
                                    inputMode="numeric"
                                    autoComplete="tel"
                                    placeholder="10-digit mobile number"
                                    value={guestForm.phone}
                                    onChange={updateGuestField('phone')}
                                    disabled={saving}
                                />
                                {guestErrors.phone && <span className="guest-field-error">{guestErrors.phone}</span>}
                            </div>

                            <div className="guest-checkout-field">
                                <label htmlFor="guest-addressLine">Complete delivery address *</label>
                                <input
                                    id="guest-addressLine"
                                    name="addressLine"
                                    type="text"
                                    autoComplete="address-line1"
                                    placeholder="House / building, street, area"
                                    value={guestForm.addressLine}
                                    onChange={updateGuestField('addressLine')}
                                    disabled={saving}
                                />
                                {guestErrors.addressLine && <span className="guest-field-error">{guestErrors.addressLine}</span>}
                            </div>

                            <div className="guest-checkout-field">
                                <label htmlFor="guest-addressLine2">Address line 2 (optional)</label>
                                <input
                                    id="guest-addressLine2"
                                    name="addressLine2"
                                    type="text"
                                    autoComplete="address-line2"
                                    placeholder="Landmark, apartment, etc."
                                    value={guestForm.addressLine2}
                                    onChange={updateGuestField('addressLine2')}
                                    disabled={saving}
                                />
                            </div>

                            <div className="guest-checkout-row">
                                <div className="guest-checkout-field">
                                    <label htmlFor="guest-city">City *</label>
                                    <input
                                        id="guest-city"
                                        name="city"
                                        type="text"
                                        autoComplete="address-level2"
                                        value={guestForm.city}
                                        onChange={updateGuestField('city')}
                                        disabled={saving}
                                    />
                                    {guestErrors.city && <span className="guest-field-error">{guestErrors.city}</span>}
                                </div>

                                <div className="guest-checkout-field">
                                    <label htmlFor="guest-postalCode">PIN / postal code *</label>
                                    <input
                                        id="guest-postalCode"
                                        name="postalCode"
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="postal-code"
                                        placeholder="6-digit PIN"
                                        value={guestForm.postalCode}
                                        onChange={updateGuestField('postalCode')}
                                        disabled={saving}
                                    />
                                    {guestErrors.postalCode && <span className="guest-field-error">{guestErrors.postalCode}</span>}
                                </div>
                            </div>

                            <div className="guest-checkout-row">
                                <div className="guest-checkout-field">
                                    <label htmlFor="guest-state">State (optional)</label>
                                    <input
                                        id="guest-state"
                                        name="state"
                                        type="text"
                                        autoComplete="address-level1"
                                        value={guestForm.state}
                                        onChange={updateGuestField('state')}
                                        disabled={saving}
                                    />
                                </div>

                                <div className="guest-checkout-field">
                                    <label htmlFor="guest-email">Email (optional)</label>
                                    <input
                                        id="guest-email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        value={guestForm.email}
                                        onChange={updateGuestField('email')}
                                        disabled={saving}
                                    />
                                    {guestErrors.email && <span className="guest-field-error">{guestErrors.email}</span>}
                                </div>
                            </div>

                            {error && <div className="checkout-error">{error}</div>}

                            <div className="guest-checkout-actions">
                                <button
                                    type="button"
                                    className="btn btn-outline btn-lg"
                                    onClick={closeGuestForm}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-whatsapp btn-lg"
                                    disabled={saving}
                                >
                                    <MessageCircle size={20} />
                                    {saving ? 'Placing your order…' : 'Place order & send on WhatsApp'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
};

export default Checkout;

