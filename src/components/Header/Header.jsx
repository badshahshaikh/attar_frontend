import React, { useState, useRef, useEffect } from 'react';
import { Search, Heart, ShoppingBag, Menu, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { mockProducts } from '../../data/mockProducts';
import './Header.css';

const Header = ({ toggleMobileMenu }) => {
    const { cartCount } = useCart();
    const { wishlistItems } = useWishlist();
    const navigate = useNavigate();

    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const searchRef = useRef(null);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }
        const lower = searchQuery.toLowerCase();
        const results = mockProducts.filter(p =>
            p.name.toLowerCase().includes(lower) ||
            p.description.toLowerCase().includes(lower) ||
            p.fragranceType.toLowerCase().includes(lower) ||
            p.topNotes.some(n => n.toLowerCase().includes(lower)) ||
            p.heartNotes.some(n => n.toLowerCase().includes(lower)) ||
            p.baseNotes.some(n => n.toLowerCase().includes(lower))
        ).slice(0, 5); // limit to top 5
        setSearchResults(results);
    }, [searchQuery]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setIsSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/?search=${encodeURIComponent(searchQuery)}`);
            setIsSearchOpen(false);
            setSearchQuery('');
        }
    };

    const handleResultClick = (id) => {
        navigate(`/product/${id}`);
        setIsSearchOpen(false);
        setSearchQuery('');
    };

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
                    <div ref={searchRef} className="search-container">
                        <button
                            className="action-btn"
                            aria-label="Search"
                            onClick={() => setIsSearchOpen(!isSearchOpen)}
                        >
                            <Search size={20} strokeWidth={1.5} />
                        </button>

                        {isSearchOpen && (
                            <div className="search-overlay">
                                <form className="search-form" onSubmit={handleSearchSubmit}>
                                    <input
                                        type="text"
                                        className="header-search-input"
                                        placeholder="Search premium attars..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        autoFocus
                                    />
                                    <button type="button" className="close-search-btn" onClick={() => setIsSearchOpen(false)}>
                                        <X size={18} />
                                    </button>
                                </form>

                                {searchQuery.trim() && (
                                    <div className="search-results">
                                        {searchResults.length > 0 ? (
                                            searchResults.map(product => (
                                                <div
                                                    key={product.id}
                                                    className="search-result-item"
                                                    onClick={() => handleResultClick(product.id)}
                                                >
                                                    <img src={product.imageUrl} alt={product.name} />
                                                    <div className="search-result-info">
                                                        <h4>{product.name}</h4>
                                                        <span>{product.fragranceType}</span>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="search-no-results">No products found.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <Link to="/wishlist" className="action-btn cart-btn" aria-label="Wishlist">
                        <Heart size={20} strokeWidth={1.5} />
                        {wishlistItems.length > 0 && <span className="cart-count wishlist-count">{wishlistItems.length}</span>}
                    </Link>
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
