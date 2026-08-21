import React from 'react';
import { Search, Heart, ShoppingBag, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import './Header.css';

const Header = ({ toggleMobileMenu }) => {
    const { cartCount } = useCart();

    return (
        <header className="header">
            <div className="container header-inner">
                {/* Mobile menu toggle */}
                <button className="mobile-menu-btn" onClick={toggleMobileMenu}>
                    <Menu size={20} />
                </button>

                {/* Brand Logo */}
                <div className="logo">
                    <Link to="/">RoohAttars</Link>
                </div>

                {/* Navigation */}
                <nav className="nav-links">
                    <Link to="/" className="active">Shop</Link>
                    <a href="#">Collections</a>
                    <a href="#">About Us</a>
                    <a href="#">Journal</a>
                </nav>

                {/* Right Actions */}
                <div className="header-actions">
                    <button className="action-btn" aria-label="Search">
                        <Search size={20} strokeWidth={1.5} />
                    </button>
                    <button className="action-btn" aria-label="Wishlist">
                        <Heart size={20} strokeWidth={1.5} />
                    </button>
                    <Link to="/cart" className="action-btn cart-btn" aria-label="Cart">
                        <ShoppingBag size={20} strokeWidth={1.5} />
                        {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
                    </Link>
                </div>
            </div>
        </header>
    );
};

export default Header;
