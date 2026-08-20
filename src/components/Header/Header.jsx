import React from 'react';
import { Search, Heart, ShoppingBag, Menu } from 'lucide-react';
import './Header.css';

const Header = ({ toggleMobileMenu }) => {
    return (
        <header className="header">
            <div className="container header-inner">
                {/* Mobile menu toggle */}
                <button className="mobile-menu-btn" onClick={toggleMobileMenu}>
                    <Menu size={20} />
                </button>

                {/* Brand Logo */}
                <div className="logo">
                    <a href="/">RoohAttars</a>
                </div>

                {/* Navigation */}
                <nav className="nav-links">
                    <a href="#" className="active">Shop</a>
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
                    <button className="action-btn cart-btn" aria-label="Cart">
                        <ShoppingBag size={20} strokeWidth={1.5} />
                        <span className="cart-count">2</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
