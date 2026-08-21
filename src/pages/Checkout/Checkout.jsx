import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { MessageCircle, ArrowLeft } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { WHATSAPP_NUMBER } from '../../config/constants';
import './Checkout.css';

const Checkout = () => {
    const { state, cartSubtotal } = useCart();
    const { items } = state;

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

    const shippingCharge = items.length > 0 ? (cartSubtotal > 5000 ? 0 : 150) : 0;
    const finalTotal = cartSubtotal + shippingCharge;

    const handleWhatsAppCheckout = () => {
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

        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

        window.open(whatsappUrl, '_blank');
    };

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

                        <div className="whatsapp-checkout-action">
                            <button
                                className="btn btn-whatsapp btn-lg w-100"
                                onClick={handleWhatsAppCheckout}
                            >
                                <MessageCircle size={20} />
                                Proceed with WhatsApp
                            </button>
                            <p className="whatsapp-help-text">
                                Send your order details directly to us on WhatsApp.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Checkout;
