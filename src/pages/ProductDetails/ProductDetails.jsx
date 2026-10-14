import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Star, Heart, Share2, Plus, Minus, ShieldCheck, Truck } from 'lucide-react';
import ProductGrid from '../../components/ProductGrid/ProductGrid';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useProducts } from '../../context/ProductContext';
import { isProductAvailable, getAvailableStock, clampQuantity } from '../../utils/stock';
import './ProductDetails.css';

const ProductDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { dispatch } = useCart();
    const { toggleWishlist, isInWishlist } = useWishlist();
    const { products, loading, error, getProductDetails } = useProducts();
    const [product, setProduct] = useState(null);
    const [selectedSize, setSelectedSize] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [currentPrice, setCurrentPrice] = useState(0);
    const [activeImage, setActiveImage] = useState('');
    const [detailLoading, setDetailLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

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
                const foundProduct = await getProductDetails(id);

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
    }, [id, getProductDetails]);

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
                        <img src={activeImage || product.imageUrl} alt={product.name} className="main-image" />
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
                                    <img src={imageUrl} alt={`${product.name} view ${index + 1}`} />
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
