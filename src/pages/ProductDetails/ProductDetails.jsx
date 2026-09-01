import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Star, Heart, Share2, Plus, Minus, ShieldCheck, Truck } from 'lucide-react';
import ProductGrid from '../../components/ProductGrid/ProductGrid';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useProducts } from '../../context/ProductContext';
import './ProductDetails.css';

const ProductDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { dispatch } = useCart();
    const { toggleWishlist, isInWishlist } = useWishlist();
    const { products, loading, error, getProductById } = useProducts();
    const [product, setProduct] = useState(null);
    const [selectedSize, setSelectedSize] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [currentPrice, setCurrentPrice] = useState(0);

    useEffect(() => {
        const foundProduct = getProductById(id);
        if (foundProduct) {
            setProduct(foundProduct);
            setSelectedSize(foundProduct.sizes[0]);
            setCurrentPrice(foundProduct.sizePricing[foundProduct.sizes[0]]);
            setQuantity(1);
        }
    }, [id, getProductById]);

    if (loading) {
        return <div className="container py-20 text-center">Loading product...</div>;
    }

    if (error) {
        return <div className="container py-20 text-center">{error}</div>;
    }

    if (!product) {
        return <div className="container py-20 text-center">Product not found</div>;
    }

    const handleSizeChange = (size) => {
        setSelectedSize(size);
        setCurrentPrice(product.sizePricing[size]);
    };

    const handleQuantityChange = (type) => {
        if (type === 'inc') {
            setQuantity(prev => prev + 1);
        } else if (type === 'dec' && quantity > 1) {
            setQuantity(prev => prev - 1);
        }
    };

    const handleAddToCart = () => {
        const cartItem = {
            productId: product.id,
            name: product.name,
            size: selectedSize,
            quantity: quantity,
            price: currentPrice,
            total: currentPrice * quantity,
            image: product.imageUrl
        };
        dispatch({ type: 'ADD_TO_CART', payload: cartItem });
        navigate('/cart');
    };

    const relatedProducts = products.filter(p => p.id !== product.id).slice(0, 3);

    return (
        <main className="product-details-page">
            {/* Dynamic simple breadcrumb for this page */}
            <nav className="breadcrumb container">
                <ol>
                    <li><Link to="/">Home</Link></li>
                    <li className="separator">/</li>
                    <li><Link to="/">Shop</Link></li>
                    <li className="separator">/</li>
                    <li className="active" aria-current="page">{product.name}</li>
                </ol>
            </nav>

            <div className="product-hero container">
                {/* Left: Image Gallery */}
                <div className="product-gallery">
                    <div className="main-image-container">
                        {product.isNew && <span className="product-badge new">New</span>}
                        <img src={product.imageUrl} alt={product.name} className="main-image" />
                    </div>
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
                            <button onClick={() => handleQuantityChange('dec')}><Minus size={16} /></button>
                            <span>{quantity}</span>
                            <button onClick={() => handleQuantityChange('inc')}><Plus size={16} /></button>
                        </div>
                        <button
                            className="btn btn-primary add-to-cart-large"
                            onClick={handleAddToCart}
                            disabled={!product.inStock}
                        >
                            {product.inStock ? `Add to Cart - ₹${(currentPrice * quantity).toLocaleString()}` : 'Out of Stock'}
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
