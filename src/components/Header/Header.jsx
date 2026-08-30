import React, { useState, useRef, useEffect } from 'react';
import { Search, Heart, ShoppingBag, Menu, X, ChevronDown } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { mockProducts } from '../../data/mockProducts';
import './Header.css';

const Header = () => {
    const { cartCount } = useCart();
    const { wishlistItems } = useWishlist();
    const navigate = useNavigate();
    const location = useLocation();

    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const searchRef = useRef(null);

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isBrandsDropdownOpen, setIsBrandsDropdownOpen] = useState(false);
    const [isMobileBrandsOpen, setIsMobileBrandsOpen] = useState(false);
    const [isFragranceDropdownOpen, setIsFragranceDropdownOpen] = useState(false);
    const [isMobileFragranceOpen, setIsMobileFragranceOpen] = useState(false);
    const brandsDropdownRef = useRef(null);
    const fragranceDropdownRef = useRef(null);

    const brands = [
        { name: "MS Fragrance Exclusive", value: "MS Fragrance", exclusive: true },
        { name: "Inspired Fragrances", value: "Inspired Fragrances", exclusive: false },
        { name: "Surrati", value: "Surrati", exclusive: false },
        { name: "Anfar", value: "Anfar", exclusive: false },
        { name: "SMD Ayyub MD Yaqub", value: "SMD Ayyub MD Yaqub", exclusive: false },
        { name: "Al Haramain", value: "Al Haramain", exclusive: false },
        { name: "Swiss Arabian", value: "Swiss Arabian", exclusive: false },
        { name: "Nemat", value: "Nemat", exclusive: false },
        { name: "S.H. Kelkar", value: "S.H. Kelkar", exclusive: false }
    ];

    const fragranceFamilies = [
        { name: "Oud", value: "oud" },
        { name: "Musk", value: "musk" },
        { name: "Amber", value: "amber" },
        { name: "Shamama", value: "shamama" },
        { name: "Floral", value: "floral" },
        { name: "French", value: "french" },
        { name: "Khas", value: "khas" },
        { name: "Dehn Al Oud", value: "dehn-al-oud" }
    ];

    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

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
            if (brandsDropdownRef.current && !brandsDropdownRef.current.contains(e.target)) {
                setIsBrandsDropdownOpen(false);
            }
            if (fragranceDropdownRef.current && !fragranceDropdownRef.current.contains(e.target)) {
                setIsFragranceDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/shop?search=${encodeURIComponent(searchQuery)}`);
            setIsSearchOpen(false);
            setSearchQuery('');
        }
    };

    const handleResultClick = (id) => {
        navigate(`/product/${id}`);
        setIsSearchOpen(false);
        setSearchQuery('');
    };

    const handleNavClick = (collection, brand = null) => {
        const params = new URLSearchParams();
        if (collection) {
            params.set('collection', collection);
        }
        if (brand) {
            params.set('brand', brand);
        }
        navigate(`/shop?${params.toString()}`);
        setIsBrandsDropdownOpen(false);
    };

    const handleBrandClick = (brandValue, isExclusive = false) => {
        const params = new URLSearchParams();
        params.set('brand', brandValue);
        if (isExclusive) {
            params.set('collection', 'exclusive');
        }
        navigate(`/shop?${params.toString()}`);
        setIsBrandsDropdownOpen(false);
    };

    const handleFragranceClick = (fragranceValue) => {
        const params = new URLSearchParams();
        params.set('collection', fragranceValue);
        navigate(`/shop?${params.toString()}`);
        setIsFragranceDropdownOpen(false);
    };

    const isActiveNav = (path) => {
        if (path === '/') return location.pathname === '/';
        if (path.startsWith('/shop')) return location.pathname.startsWith('/shop');
        return location.pathname === path;
    };

    const getActiveClass = (collection) => {
        const currentCollection = new URLSearchParams(location.search).get('collection');
        return currentCollection === collection ? 'active' : '';
    };

    return (
        <header className="header">
            <div className="container header-inner">
                {/* Mobile menu toggle */}
                <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
                    <Menu size={20} />
                </button>

                {/* Brand Logo */}
                <div className="logo">
                    <Link to="/">
                        <picture>
                            <source
                                media="(max-width: 767px)"
                                srcSet="/ms-fragrance-mobile.png"
                            />

                            <img
                                src="/ms-fragrance.png"
                                alt="MS Fragrance"
                            />
                        </picture>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="nav-links" aria-label="Main navigation">
                    <Link to="/" className={isActiveNav('/') ? 'active' : ''}>Home</Link>
                    <button 
                        className={`nav-link-btn ${getActiveClass('best-sellers')}`}
                        onClick={() => handleNavClick('best-sellers')}
                    >
                        Best Sellers
                    </button>
                    <div 
                        className="nav-item-with-dropdown"
                        ref={brandsDropdownRef}
                        onMouseEnter={() => setIsBrandsDropdownOpen(true)}
                        onMouseLeave={() => setIsBrandsDropdownOpen(false)}
                    >
                        <button className="nav-link-btn">
                            Brands
                            <ChevronDown size={14} className="nav-chevron" />
                        </button>
                        {isBrandsDropdownOpen && (
                            <div className="brands-dropdown">
                                {brands.map((brand) => (
                                    <button
                                        key={brand.value}
                                        className="brand-dropdown-item"
                                        onClick={() => handleBrandClick(brand.value, brand.exclusive)}
                                    >
                                        {brand.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div 
                        className="nav-item-with-dropdown"
                        ref={fragranceDropdownRef}
                        onMouseEnter={() => setIsFragranceDropdownOpen(true)}
                        onMouseLeave={() => setIsFragranceDropdownOpen(false)}
                    >
                        <button className="nav-link-btn">
                            Fragrance Family
                            <ChevronDown size={14} className="nav-chevron" />
                        </button>
                        {isFragranceDropdownOpen && (
                            <div className="fragrance-dropdown">
                                {fragranceFamilies.map((fragrance) => (
                                    <button
                                        key={fragrance.value}
                                        className="fragrance-dropdown-item"
                                        onClick={() => handleFragranceClick(fragrance.value)}
                                    >
                                        {fragrance.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button 
                        className={`nav-link-btn ${getActiveClass('ms-fragrance')}`}
                        onClick={() => handleNavClick(null, 'MS Fragrance')}
                    >
                        MS Fragrance
                    </button>
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

            {/* Mobile Nav Drawer */}
            <div className={`mobile-nav-drawer ${isMobileMenuOpen ? 'open' : ''}`}>
                <div className="mobile-nav-header">
                    <span className="mobile-nav-title">Menu</span>
                    <button className="close-mobile-nav" onClick={() => setIsMobileMenuOpen(false)}>
                        <X size={24} />
                    </button>
                </div>
                <nav className="mobile-nav-links" aria-label="Mobile navigation">
                    <Link to="/" onClick={() => setIsMobileMenuOpen(false)}>Home</Link>
                    <button 
                        className="mobile-nav-link-btn"
                        onClick={() => {
                            handleNavClick('best-sellers');
                            setIsMobileMenuOpen(false);
                        }}
                    >
                        Best Sellers
                    </button>
                    <div className="mobile-nav-accordion">
                        <button 
                            className="mobile-nav-accordion-header"
                            onClick={() => setIsMobileBrandsOpen(!isMobileBrandsOpen)}
                        >
                            Brands
                            <ChevronDown 
                                size={16} 
                                className={`mobile-nav-chevron ${isMobileBrandsOpen ? 'open' : ''}`} 
                            />
                        </button>
                        {isMobileBrandsOpen && (
                            <div className="mobile-nav-accordion-content">
                                {brands.map((brand) => (
                                    <button
                                        key={brand.value}
                                        className="mobile-nav-accordion-item"
                                        onClick={() => {
                                            handleBrandClick(brand.value, brand.exclusive);
                                            setIsMobileMenuOpen(false);
                                        }}
                                    >
                                        {brand.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="mobile-nav-accordion">
                        <button 
                            className="mobile-nav-accordion-header"
                            onClick={() => setIsMobileFragranceOpen(!isMobileFragranceOpen)}
                        >
                            Fragrance Family
                            <ChevronDown 
                                size={16} 
                                className={`mobile-nav-chevron ${isMobileFragranceOpen ? 'open' : ''}`} 
                            />
                        </button>
                        {isMobileFragranceOpen && (
                            <div className="mobile-nav-accordion-content">
                                {fragranceFamilies.map((fragrance) => (
                                    <button
                                        key={fragrance.value}
                                        className="mobile-nav-accordion-item"
                                        onClick={() => {
                                            handleFragranceClick(fragrance.value);
                                            setIsMobileMenuOpen(false);
                                        }}
                                    >
                                        {fragrance.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button 
                        className="mobile-nav-link-btn"
                        onClick={() => {
                            handleNavClick(null, 'MS Fragrance');
                            setIsMobileMenuOpen(false);
                        }}
                    >
                        MS Fragrance
                    </button>
                    <Link to="/wishlist" onClick={() => setIsMobileMenuOpen(false)}>Wishlist</Link>
                    <Link to="/cart" onClick={() => setIsMobileMenuOpen(false)}>Cart</Link>
                </nav>
            </div>

            {/* Backdrop for the Mobile Drawer */}
            {isMobileMenuOpen && (
                <div className="mobile-nav-backdrop" onClick={() => setIsMobileMenuOpen(false)}></div>
            )}
        </header>
    );
};

export default Header;
