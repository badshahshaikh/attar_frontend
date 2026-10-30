import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Star, Heart, Share2, Plus, Minus, ShieldCheck, Truck } from 'lucide-react';
import ProductGrid from '../../components/ProductGrid/ProductGrid';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useProducts } from '../../context/ProductContext';
import { isProductAvailable, getAvailableStock, clampQuantity } from '../../utils/stock';
import { getProductUrl } from '../../utils/productUrl';
import './ProductDetails.css';

const ProductDetails = () => {
    const { slugId } = useParams();
    const navigate = useNavigate();

    // Extract the authoritative numeric database ID from the trailing segment of
    // the slugId param. Handles both descriptive (/product/mukhallat-jahara-74)
    // and legacy numeric (/product/74) URLs.
    const numericIdMatch = String(slugId ?? '').match(/(\d+)$/);
    const numericId = numericIdMatch ? numericIdMatch[1] : null;

    const { dispatch } = useCart();
    const { toggleWishlist, isInWishlist } = useWishlist();
    const { products, loading, error, getProductDetails, getProductById } = useProducts();
    const [product, setProduct] = useState(null);
    const [selectedSize, setSelectedSize] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [currentPrice, setCurrentPrice] = useState(0);
    const [activeImage, setActiveImage] = useState('');
    const [detailLoading, setDetailLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    // Client-side fallback redirect for legacy numeric URLs (e.g. /product/74)
    // when the Vercel edge redirect has not yet been applied (dev, or stale
    // redirect list). Looks up the product in the catalog cache and navigates to
    // the canonical descriptive URL.
    useEffect(() => {
        if (!numericId || !/^\d+$/.test(String(slugId))) return;

        const cached = getProductById(numericId);
        if (cached && cached.slug) {
            navigate(getProductUrl(cached), { replace: true });
        }
    }, [slugId, numericId, navigate, getProductById]);

    // Redirect a legacy numeric URL opened directly (uncached) to the canonical
    // descriptive URL once the product has loaded, so the browser always ends
    // up on /product/{slug}-{id}. A descriptive URL is never rewritten back to
    // numeric because the guard above requires slugId to be purely numeric.
    useEffect(() => {
        if (!numericId || !/^\d+$/.test(String(slugId))) return;
        if (!product || !product.slug) return;

        const canonical = getProductUrl(product);
        if (String(slugId) !== getProductUrl(product)) {
            navigate(canonical, { replace: true });
        }
    }, [slugId, numericId, product, navigate]);

    useEffect(() => {
        let cancelled = false;

        const applyProduct = (foundProduct) => {
            setProduct(foundProduct);
            const firstSize = foundProduct.sizes[0] || '';
            setSelectedSize(firstSize);
            setCurrentPrice(foundProduct.sizePricing[firstSize] || foundProduct.price || 0);
            setQuantity(clampQuantity(1, foundProduct));
            const galleryImages = Array.isArray(foundProduct.imageUrls) && foundProduct.imageUrls.length > 0
                ? foundProduct.imageUrls
                : (foundProduct.imageUrl ? [foundProduct.imageUrl] : []);
            setActiveImage(galleryImages[0] || '');
        };

        const resolveProduct = async () => {
            setDetailLoading(true);
            setNotFound(false);

            try {
                // Cache-first: resolves from the loaded catalog slice (by numeric
                // id or slug), falling back to GET /api/products/:id for items
                // outside the current page — e.g. opened from global search.
                const foundProduct = await getProductDetails(numericId);

                if (cancelled) {
                    return;
                }

                if (foundProduct) {
                    applyProduct(foundProduct);
                } else {
                    setProduct(null);
                    setNotFound(true);
                }
            } catch (detailError) {
                if (!cancelled) {
                    setProduct(null);
                    setNotFound(true);
                }
            } finally {
                if (!cancelled) {
                    setDetailLoading(false);
                }
            }
        };

        resolveProduct();

        return () => {
            cancelled = true;
        };
    }, [numericId, getProductDetails]);

    if (loading || detailLoading) {
        return <div className="container py-20 text-center">Loading product...</div>;
    }

    if (error) {
        return <div className="container py-20 text-center">{error}</div>;
    }

    if (notFound || !product) {
        return <div className="container py-20 text-center">Product not found</div>;
    }

    const handleSizeChange = (size) => {
        setSelectedSize(size);
        setCurrentPrice(product.sizePricing[size] || product.price || 0);
    };

    // A product is sellable only when it is flagged in stock AND has a positive
    // quantity. Never let the picker exceed what is actually available.
    const available = isProductAvailable(product);
    const maxStock = getAvailableStock(product);
    const atStockLimit = quantity >= maxStock;

    const handleQuantityChange = (type) => {
        if (type === 'inc') {
            setQuantity(prev => clampQuantity(prev + 1, product));
        } else if (type === 'dec' && quantity > 1) {
            setQuantity(prev => prev - 1);
        }
    };

    const handleAddToCart = () => {
        // Re-check availability at the moment of adding; clamp to stock so a
        // stale quantity can never push more units into the cart than exist.
        if (!available) {
            return;
        }

        const safeQuantity = clampQuantity(quantity, product);
        if (safeQuantity < 1) {
            return;
        }

        const cartItem = {
            productId: product.id,
            name: product.name,
            size: selectedSize,
            quantity: safeQuantity,
            price: currentPrice,
            total: currentPrice * safeQuantity,
            image: product.imageUrl,
            inStock: product.inStock,
            stockQuantity: product.stockQuantity
        };
        dispatch({ type: 'ADD_TO_CART', payload: cartItem });
        navigate('/cart');
    };

    const relatedProducts = products.filter(p => p.id !== product.id).slice(0, 3);

    return (
        <main className="product-details-page">
            {/* Dynamic simple breadcrumb for this page */}
            <nav className="breadcrumb-container container" aria-label="Breadcrumb">
                <ol>
                    <li><Link to="/">Home</Link></li>
                    <li className="separator">/</li>
                    <li><Link to="/shop">Shop</Link></li>
                    <li className="separator">/</li>
                    <li className="active" aria-current="page">{product.name}</li>
                </ol>
            </nav>

            <div className="product-hero container">
                {/* Left: Image Gallery */}
                <div className="product-gallery">
                    <div className="main-image-container">
                        {product.isNew && <span className="product-badge new">New</span>}
                        <img src={activeImage || product.imageUrl} alt={product.name} className="main-image" loading="eager" fetchPriority="high" decoding="async" />
                    </div>
                    {Array.isArray(product.imageUrls) && product.imageUrls.length > 1 && (
                        <div className="product-gallery-thumbs">
                            {product.imageUrls.map((imageUrl, index) => (
                                <button
                                    key={`${imageUrl}-${index}`}
                                    type="button"
                                    className={`product-gallery-thumb${activeImage === imageUrl ? ' active' : ''}`}
                                    onClick={() => setActiveImage(imageUrl)}
                                >
                                    <img src={imageUrl} alt={`${product.name} view ${index + 1}`} loading="lazy" decoding="async" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Product Info */}
                <div className="product-info-block">
                    <div className="product-meta-header">
                        <span className="product-category">{product.fragranceType}</span>
                        <div className="product-rating">
                            <Star size={14} fill="currentColor" className="star-icon" />
                            <Star size={14} fill="currentColor" className="star-icon" />
                            <Star size={14} fill="currentColor" className="star-icon" />
                            <Star size={14} fill="currentColor" className="star-icon" />
                            <Star size={14} fill="currentColor" className="star-icon half" />
                            <span>{product.rating} ({product.reviews} reviews)</span>
                        </div>
                    </div>

                    <h1 className="product-title-large">{product.name}</h1>
                    <p className="product-short-desc">{product.description}</p>

                    <div className="product-price-large">
                        ₹{currentPrice.toLocaleString()}
                    </div>

                    <div className="selector-section">
                        <h4 className="selector-title">Select Size</h4>
                        <div className="size-selector">
                            {product.sizes.map((size) => (
                                <button
                                    key={size}
                                    className={`size-btn ${selectedSize === size ? 'active' : ''}`}
                                    onClick={() => handleSizeChange(size)}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="action-row">
                        <div className="qty-selector">
                            <button onClick={() => handleQuantityChange('dec')} disabled={!available || quantity <= 1}><Minus size={16} /></button>
                            <span>{quantity}</span>
                            <button onClick={() => handleQuantityChange('inc')} disabled={!available || atStockLimit}><Plus size={16} /></button>
                        </div>
                        <button
                            className="btn btn-primary add-to-cart-large"
                            onClick={handleAddToCart}
                            disabled={!available}
                        >
                            {available ? `Add to Cart - ₹${(currentPrice * quantity).toLocaleString()}` : 'Out of Stock'}
                        </button>
                        <button
                            className="btn-icon wishlist-btn-lg"
                            title="Toggle Wishlist"
                            onClick={() => toggleWishlist(product.id)}
                        >
                            <Heart
                                size={20}
                                strokeWidth={1.5}
                                fill={isInWishlist(product.id) ? 'currentColor' : 'none'}
                                color={isInWishlist(product.id) ? '#ff4d4f' : 'currentColor'}
                            />
                        </button>
                    </div>

                    <div className="product-trust-badges">
                        <div className="trust-badge">
                            <ShieldCheck size={20} className="trust-icon" />
                            <span>100% Pure & Authentic</span>
                        </div>
                        <div className="trust-badge">
                            <Truck size={20} className="trust-icon" />
                            <span>Free Domestic Shipping over ₹5000</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="product-details-tabs container">
                <div className="details-section">
                    <h2>The Experience</h2>
                    <p>{product.fullDescription}</p>
                </div>

                <div className="fragrance-pyramid">
                    <h2>Fragrance Profile</h2>
                    <div className="pyramid-grid">
                        <div className="pyramid-item">
                            <span className="pyramid-label">Top Notes</span>
                            <span className="pyramid-value">{product.topNotes.join(' • ')}</span>
                        </div>
                        <div className="pyramid-item">
                            <span className="pyramid-label">Heart Notes</span>
                            <span className="pyramid-value">{product.heartNotes.join(' • ')}</span>
                        </div>
                        <div className="pyramid-item">
                            <span className="pyramid-label">Base Notes</span>
                            <span className="pyramid-value">{product.baseNotes.join(' • ')}</span>
                        </div>
                        <div className="pyramid-item longevity">
                            <span className="pyramid-label">Longevity</span>
                            <span className="pyramid-value">{product.longevity}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="related-products container">
                <h2 className="section-title text-center">You May Also Like</h2>
                <ProductGrid products={relatedProducts} />
            </div>
        </main>
    );
};

export default ProductDetails;
