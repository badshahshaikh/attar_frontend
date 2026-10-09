import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, ArrowLeft, CircleCheck, CreditCard } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { fetchAddresses, createOrder, verifyPayment } from '../../services/customerService';
import { openRazorpayCheckout } from '../../services/paymentRazorpay';
import { WHATSAPP_NUMBER } from '../../config/constants';
import './Checkout.css';

/**
 * Checkout — reviews the basket and hands it over to WhatsApp.
 *
 * Signed-in customers: the order is first recorded server-side
 * (POST /api/customer/orders — prices/shipping are computed from the products
 * table, never trusted from the client) and the WhatsApp message then carries
 * the real order number. Guests keep the original message-only flow.
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

    const buildWhatsAppUrl = (message) =>
        `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    // WhatsApp must open synchronously inside the click handler. Browsers
    // block `window.open` calls that happen after an `await` (the user-gesture
    // context is lost), so we open a blank tab up-front and navigate it to
    // the real URL once the order exists. If the popup is blocked entirely,
    // `window.open` returns null and the stored URL keeps the on-page
    // "Continue on WhatsApp" link working as a fallback.
    const openWhatsAppTab = () => {
        try {
            const tab = window.open('', '_blank', 'noopener');
            return tab;
        } catch {
            return null;
        }
    };

    const navigateTab = (tab, message) => {
        const url = buildWhatsAppUrl(message);
        if (tab && !tab.closed) {
            tab.location.href = url;
        } else {
            window.open(url, '_blank');
        }
        return url;
    };

    // Guest basket message — identical to the flow before accounts existed.
    const buildGuestMessage = () => {
        let message = "Hello, I would like to place an order.\n\nOrder Details:\n\n";

        items.forEach((item, index) => {
            message += `${index + 1}. ${item.name}\n`;
            message += `   Size: ${item.size}\n`;
            message += `   Quantity: ${item.quantity}\n`;
            message += `   Unit Price: ₹${item.price.toLocaleString()}\n`;
            message += `   Item Total: ₹${item.total.toLocaleString()}\n\n`;
        });

        message += `Subtotal: ₹${cartSubtotal.toLocaleString()}\n`;
        message += `Shipping: ${shippingCharge === 0 ? 'To be confirmed' : `₹${shippingCharge.toLocaleString()}`}\n`;
        message += `Total: ₹${finalTotal.toLocaleString()}\n\n`;

        message += "Please confirm the availability and order details.";
        return message;
    };

    // Logged-in message — built from the *server* response so the totals in
    // the chat can never drift from what was actually recorded.
    const buildOrderMessage = (order) => {
        let message = `Hello! I just placed an order on the website.\n\nOrder Details:\n\n`;

        order.items.forEach((item, index) => {
            message += `${index + 1}. ${item.productName}\n`;
            message += `   Size: ${item.size}\n`;
            message += `   Quantity: ${item.quantity}\n`;
            message += `   Unit Price: ₹${Number(item.unitPrice).toLocaleString()}\n`;
            message += `   Item Total: ₹${Number(item.lineTotal).toLocaleString()}\n\n`;
        });

        message += `Subtotal: ₹${Number(order.subtotal).toLocaleString()}\n`;
        message += `Shipping: ${Number(order.shipping) === 0 ? 'Free' : `₹${Number(order.shipping).toLocaleString()}`}\n`;
        message += `Total: ₹${Number(order.total).toLocaleString()}\n\n`;
        message += `My order number is ${order.orderNumber} — please confirm the availability and payment details.`;
        return message;
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

        // Guest: nothing is recorded server-side, keep the original flow.
        // No async work happens first, so the user gesture is intact and the
        // popup cannot be blocked.
        if (!user) {
            window.open(buildWhatsAppUrl(buildGuestMessage()), '_blank');
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
                            : 'Your order has been saved to your account. You can pay online below or continue on WhatsApp.'}
                    </p>
                    <div className="checkout-success-actions">
                        {placedOrder.paymentStatus !== 'paid' && (
                            <button
                                className="btn btn-primary btn-lg"
                                onClick={handlePayOnline}
                                disabled={paying || saving}
                            >
                                {paying ? 'Opening payment…' : 'Pay Online (UPI / Cards)'}
                            </button>
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

                        <Link to="/account" className="btn btn-primary btn-lg">
                            View my orders
                        </Link>
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
                                    : 'Send your order details directly to us on WhatsApp.'}
                            </p>
                            {!user && (
                                <p className="whatsapp-help-text">
                                    <Link to="/login">Sign in</Link> to save this order to your
                                    account.
                                </p>
                            )}
                            {user && (
                                <>
                                    <button
                                        className="btn btn-primary btn-lg"
                                        onClick={handlePayOnline}
                                        disabled={paying || saving || authLoading}
                                    >
                                        <CreditCard size={20} />
                                        {paying ? 'Opening payment…' : 'Pay Online (UPI / Cards)'}
                                    </button>
                                    <p className="whatsapp-help-text">Pay via UPI, card, or netbanking. Your order and address are saved.</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Checkout;

