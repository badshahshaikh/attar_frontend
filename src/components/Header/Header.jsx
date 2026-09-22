import React, { useState, useRef, useEffect } from 'react';
import { Search, Heart, ShoppingBag, Menu, X, ChevronDown } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useProducts } from '../../context/ProductContext';
import './Header.css';

const Header = () => {
    const { cartCount } = useCart();
    const { wishlistItems } = useWishlist();
    const { products, brands, fragranceFamilies, searchProducts } = useProducts();
    const navigate = useNavigate();
    const location = useLocation();

    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const searchRef = useRef(null);

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isBrandsDropdownOpen, setIsBrandsDropdownOpen] = useState(false);
    const [isMobileBrandsOpen, setIsMobileBrandsOpen] = useState(false);
    const [isFragranceDropdownOpen, setIsFragranceDropdownOpen] = useState(false);
    const [isMobileFragranceOpen, setIsMobileFragranceOpen] = useState(false);
    const brandsDropdownRef = useRef(null);
    const fragranceDropdownRef = useRef(null);
    const desktopSearchRef = useRef(null);
    const mobileSearchRef = useRef(null);

    const [currentAnnouncement, setCurrentAnnouncement] = useState(0);

    const announcements = [
        "Discover the Art of Authentic Attars",
        "Premium Fragrances Delivered Across India",
        "Exclusive Collection of Oud, Musk",
        "Free Shipping on Selected Orders"
    ];

    const brandOptions = brands.map((brand) => ({
        name: brand.name,
        value: brand.name,
        exclusive: false,
    }));
    const fragranceOptions = fragranceFamilies.map(family => ({ name: family, value: family }));

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentAnnouncement((prev) => (prev + 1) % announcements.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [announcements.length]);

    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        const query = searchQuery.trim();

        if (!query) {
            setSearchResults([]);
            setSearchLoading(false);
            return;
        }

        let cancelled = false;

        const timer = setTimeout(async () => {
            try {
                setSearchLoading(true);

                const results = await searchProducts(query, 5);

                if (!cancelled) {
                    setSearchResults(results);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Product search failed:', error);
                    setSearchResults([]);
                }
            } finally {
                if (!cancelled) {
                    setSearchLoading(false);
                }
            }
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [searchQuery, searchProducts]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (desktopSearchRef.current && !desktopSearchRef.current.contains(e.target)) {
                setIsSearchOpen(false);
            }
            if (mobileSearchRef.current && !mobileSearchRef.current.contains(e.target)) {
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

    const handleBrandClick = (brandValue) => {
        const params = new URLSearchParams();

        params.set('brand', brandValue);

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
        <>
            {/* Announcement Bar */}
            <div className="announcement-bar">
                <div className="announcement-content">
                    {announcements[currentAnnouncement]}
                </div>
            </div>

            <header className="header">
                {/* Desktop Header */}
                <div className="container desktop-header">
                    {/* Desktop Logo */}
                    <div className="logo">
                        <Link to="/">
                            <picture className="desktop-logo">
                                <img
                                    src="/ms-fragrance-logo.png"
                                    alt="MS Fragrance"
                                />
                            </picture>
                        </Link>
                    </div>

                    {/* Desktop Navigation */}
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
                                    {brandOptions.map((brand) => (
                                        <button
                                            key={brand.value}
                                            className="brand-dropdown-item"
                                            onClick={() => handleBrandClick(brand.value)}
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
                                    {fragranceOptions.map((fragrance) => (
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

                    {/* Desktop Actions */}
                    <div className="header-actions">
                        <div ref={desktopSearchRef} className="search-container">
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
                                            {searchLoading ? (
                                                <div className="search-loading">
                                                    Searching...
                                                </div>
                                            ) : searchResults.length > 0 ? (
                                                searchResults.map(product => (
                                                    <Link
                                                        key={product.id}
                                                        to={`/product/${product.id}`}
                                                        className="search-result-item"
                                                        style={{
                                                            display: 'flex',
                                                            textDecoration: 'none'
                                                        }}
                                                        onClick={() => {
                                                            setIsSearchOpen(false);
                                                            setSearchQuery('');
                                                        }}
                                                    >
                                                        <img
                                                            src={product.imageUrl}
                                                            alt={product.name}
                                                        />

                                                        <div className="search-result-info">
                                                            <h4>{product.name}</h4>
                                                            <span>{product.fragranceType}</span>
                                                        </div>
                                                    </Link>
                                                ))
                                            ) : (
                                                <div className="search-no-results">
                                                    No products found.
                                                </div>
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

                {/* Mobile Header */}
                <div className="container mobile-header">
                    {/* Mobile Branding Row */}
                    <div className="mobile-branding-row">
                        <Link to="/" className="mobile-branding">
                            <span className="mobile-brand-text">MS Fragrance</span>
                            <picture className="mobile-brand-logo">
                                <img
                                    src="/ms-fragrance-logo.png"
                                    alt="MS Fragrance"
                                />
                            </picture>
                            <span className="mobile-brand-urdu">سعد لِلطُورت</span>
                        </Link>
                    </div>

                    {/* Mobile Actions Row */}
                    <div className="mobile-actions-row">
                        <div className="mobile-actions-left">
                            <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
                                <Menu size={20} />
                            </button>
                            <div ref={mobileSearchRef} className="search-container">
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
                                                        <Link
                                                            key={product.id}
                                                            to={`/product/${product.id}`}
                                                            className="search-result-item"
                                                            style={{ display: 'flex', textDecoration: 'none' }}
                                                            onClick={(e) => {
                                                                setIsSearchOpen(false);
                                                                setSearchQuery('');
                                                            }}
                                                        >
                                                            <img src={product.imageUrl} alt={product.name} />
                                                            <div className="search-result-info">
                                                                <h4>{product.name}</h4>
                                                                <span>{product.fragranceType}</span>
                                                            </div>
                                                        </Link>
                                                    ))
                                                ) : (
                                                    <div className="search-no-results">No products found.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mobile-actions-right">
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
                                    {brandOptions.map((brand) => (
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
                                    {fragranceOptions.map((fragrance) => (
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
        </>
    );
};

export default Header;
