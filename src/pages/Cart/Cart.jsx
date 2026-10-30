import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ArrowLeft } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useProducts } from '../../context/ProductContext';
import { hasStockMetadata } from '../../context/cartReducer';
import { getAvailableStock, isProductAvailable } from '../../utils/stock';
import { fetchProductById } from '../../services/productService';
import { getProductUrlFromId } from '../../utils/productUrl';
import './Cart.css';

const Cart = () => {
    const { state, dispatch, cartSubtotal } = useCart();
    const { getProductById } = useProducts();
    const { items } = state;

    // Canonical product URL: uses the database slug as the source of truth,
    // falling back to the numeric ID only when the product has no slug.
    const cartItemUrl = (item) => {
        const product = getProductById(item.productId);
        return getProductUrlFromId(product?.slug, item.productId);
    };

    // Revalidate stock against the backend: the basket is persisted in
    // localStorage, so its inStock/stockQuantity snapshot can be stale (the
    // product may have sold out in another tab or on another device). A failed
    // refresh keeps the stored values - the server re-validates stock again,
    // atomically, when the order is placed.
    const cartProductKey = items.map(item => item.productId).join(',');
    useEffect(() => {
        if (!cartProductKey) return undefined;

        let cancelled = false;
        const ids = [...new Set(cartProductKey.split(',').map(Number))];

        Promise.all(
            ids.map(id =>
                fetchProductById(id)
                    .then(product => ({
                        productId: Number(product.id),
                        inStock: product.inStock,
                        stockQuantity: product.stockQuantity,
                    }))
                    .catch(() => null)
            )
        ).then(snapshots => {
            if (cancelled) return;
            const fresh = snapshots.filter(Boolean);
            if (fresh.length > 0) {
                dispatch({ type: 'REFRESH_STOCK', payload: fresh });
            }
        });

        return () => {
            cancelled = true;
        };
    }, [cartProductKey, dispatch]);

    // Known-unavailable = the line carries a stock snapshot and that snapshot
    // either fails the availability rule (inStock AND quantity > 0) or has been
    // clamped to zero. Lines without metadata are left alone until the refresh
    // above delivers a snapshot; the backend rejects them regardless.
    const isKnownUnavailable = (item) =>
        hasStockMetadata(item) && (!isProductAvailable(item) || item.quantity < 1);
    const hasUnavailableItem = items.some(isKnownUnavailable);

    const shippingCharge = items.length > 0 ? (cartSubtotal > 5000 ? 0 : 150) : 0;
    const finalTotal = cartSubtotal + shippingCharge;

    const handleQuantityChange = (productId, size, type, currentQuantity) => {
        let newQuantity = currentQuantity;
        if (type === 'inc') {
            newQuantity += 1;
        } else if (type === 'dec' && currentQuantity > 1) {
            newQuantity -= 1;
        }

        if (newQuantity !== currentQuantity) {
            dispatch({
                type: 'UPDATE_QUANTITY',
                payload: { productId, size, quantity: newQuantity }
            });
        }
    };

    const handleRemoveItem = (productId, size) => {
        dispatch({
            type: 'REMOVE_FROM_CART',
            payload: { productId, size }
        });
    };

    if (items.length === 0) {
        return (
            <div className="cart-page container empty-cart-container">
                <div className="empty-cart-content">
                    <h2>Your Cart is Empty</h2>
                    <p>Looks like you haven't added any luxury attars to your cart yet.</p>
                    <Link to="/" className="btn btn-primary btn-lg continue-shopping-btn">
                        <ArrowLeft size={18} /> Continue Shopping
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <main className="cart-page container">
            <h1 className="page-title">Shopping Cart</h1>

            <div className="cart-layout">
                {/* Cart Items List */}
                <div className="cart-items-section">
                    <div className="cart-items-header">
                        <span className="col-product">Product</span>
                        <span className="col-price">Price</span>
                        <span className="col-qty">Quantity</span>
                        <span className="col-total">Total</span>
                    </div>

                    <div className="cart-items-list">
                        {items.map((item, index) => (
                            <div key={`${item.productId}-${item.size}-${index}`} className="cart-item">
                                <div className="cart-item-product">
                                    <div className="cart-item-image">
                                        <img src={item.image || "https://images.unsplash.com/photo-1594035987173-1e5b2cc22bc0?q=80&w=300&auto=format&fit=crop"} alt={item.name} loading="lazy" decoding="async" width={90} height={110} />
                                    </div>
                                    <div className="cart-item-details">
                                        <Link to={cartItemUrl(item)} className="cart-item-name">{item.name}</Link>
                                        <span className="cart-item-size">Size: {item.size}</span>
                                        {isKnownUnavailable(item) && (
                                            <span className="cart-item-out-of-stock">Out of Stock</span>
                                        )}
                                        {/* Mobile only elements */}
                                        <div className="mobile-price">₹{item.price.toLocaleString()}</div>
                                        <button
                                            className="remove-btn mobile-remove"
                                            onClick={() => handleRemoveItem(item.productId, item.size)}
                                        >
                                            <Trash2 size={16} /> Remove
                                        </button>
                                    </div>
                                </div>

                                <div className="cart-item-price desktop-only">
                                    ₹{item.price.toLocaleString()}
                                </div>

                                <div className="cart-item-qty">
                                    <div className="qty-selector small">
                                        <button onClick={() => handleQuantityChange(item.productId, item.size, 'dec', item.quantity)} disabled={item.quantity <= 1}>
                                            <Minus size={14} />
                                        </button>
                                        <span>{item.quantity}</span>
                                        <button onClick={() => handleQuantityChange(item.productId, item.size, 'inc', item.quantity)} disabled={item.quantity >= getAvailableStock(item)}>
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="cart-item-total desktop-only">
                                    ₹{item.total.toLocaleString()}
                                </div>

                                <div className="cart-item-remove desktop-only">
                                    <button
                                        className="remove-btn"
                                        onClick={() => handleRemoveItem(item.productId, item.size)}
                                        aria-label="Remove item"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Cart Summary */}
                <div className="cart-summary-section">
                    <div className="cart-summary-card">
                        <h3>Order Summary</h3>

                        <div className="summary-row">
                            <span>Subtotal</span>
                            <span>₹{cartSubtotal.toLocaleString()}</span>
                        </div>

                        <div className="summary-row">
                            <span>Shipping {cartSubtotal > 5000 ? <span className="free-badge">(Free)</span> : ''}</span>
                            <span>{shippingCharge === 0 ? 'Free' : `₹${shippingCharge.toLocaleString()}`}</span>
                        </div>

                        <div className="summary-divider"></div>

                        <div className="summary-row total-row">
                            <span>Total</span>
                            <span>₹{finalTotal.toLocaleString()}</span>
                        </div>

                        {hasUnavailableItem ? (
                            <div className="cart-checkout-blocked">
                                <button className="btn btn-primary checkout-btn btn-lg w-100" disabled>
                                    Proceed to Checkout
                                </button>
                                <p className="cart-stock-warning">
                                    Some items in your cart are out of stock. Remove them to continue.
                                </p>
                            </div>
                        ) : (
                            <Link to="/checkout" className="btn btn-primary checkout-btn btn-lg w-100" style={{ display: 'flex', justifyContent: 'center' }}>
                                Proceed to Checkout
                            </Link>
                        )}

                        <div className="secure-checkout">
                            <span>Secured & Encrypted checkout</span>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Cart;
