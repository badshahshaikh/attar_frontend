import React from 'react';
import { Heart, Eye, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { isProductAvailable } from '../../utils/stock';
import './ProductCard.css';

const ProductCard = ({ product }) => {
    const { toggleWishlist, isInWishlist } = useWishlist();
    const { dispatch } = useCart();
    const inWishlist = isInWishlist(product.id);
    const available = isProductAvailable(product);

    // Same cart item shape and default size selection as ProductDetails.handleAddToCart
    const handleAddToCart = (e) => {
        // This is an action button, not a link — never navigate
        e.preventDefault();
        e.stopPropagation();

        if (!available) {
            return;
        }

        const selectedSize = product.sizes[0] || '';
        const currentPrice = product.sizePricing[selectedSize] || product.price || 0;

        dispatch({
            type: 'ADD_TO_CART',
            payload: {
                productId: product.id,
                name: product.name,
                size: selectedSize,
                quantity: 1,
                price: currentPrice,
                total: currentPrice,
                image: product.imageUrl,
                inStock: product.inStock,
                stockQuantity: product.stockQuantity
            }
        });
    };

    return (
        <div className="product-card group">
            <Link to={`/product/${product.id}`} className="product-image-container" style={{ display: 'block' }}>
                {!available ? (
                    <span className="product-badge sold-out">Sold Out</span>
                ) : product.isNew ? (
                    <span className="product-badge new">New</span>
                ) : product.originalPrice ? (
                    <span className="product-badge sale">Sale</span>
                ) : null}

                {product.imageUrl ? (
                    <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="product-image"
                        loading="lazy"
                    />
                ) : (
                    <div className="product-image-placeholder">
                        <span>No image available</span>
                    </div>
                )}

                {/* Hover Actions */}
                <div
                    className="product-actions"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                >
                    <button
                        type="button"
                        className="btn-icon"
                        title="Quick View"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Add quick-view behavior here if you have one.
                        }}
                    >
                        <Eye size={18} strokeWidth={1.5} />
                    </button>
                    <button
                        className="btn-icon"
                        title="Toggle Wishlist"
                        onClick={() => toggleWishlist(product.id)}
                    >
                        <Heart
                            size={18}
                            strokeWidth={1.5}
                            fill={inWishlist ? 'currentColor' : 'none'}
                            color={inWishlist ? '#ff4d4f' : 'currentColor'}
                        />
                    </button>
                </div>
            </Link>

            <div className="product-info">
                <div className="product-meta">
                    <span className="product-type">{product.fragranceType}</span>
                    <div className="product-rating">
                        <Star size={12} fill="currentColor" strokeWidth={0} className="star-icon" />
                        <span>{product.rating}</span>
                    </div>
                </div>

                <h3 className="product-title">
                    <Link to={`/product/${product.id}`}>{product.name}</Link>
                </h3>

                <p className="product-desc">{product.description}</p>

                <div className="product-price-row">
                    <div className="product-price">
                        <span className="current-price">₹{product.price.toLocaleString()}</span>
                        {product.originalPrice && (
                            <span className="original-price">₹{product.originalPrice.toLocaleString()}</span>
                        )}
                    </div>
                </div>

                <div className="product-sizes">
                    {product.sizes.map(size => (
                        <span key={size} className="size-pill">{size}</span>
                    ))}
                </div>

                <button
                    type="button"
                    className="btn btn-outline add-to-cart-btn"
                    style={{ display: 'flex', justifyContent: 'center' }}
                    onClick={handleAddToCart}
                    disabled={!available}
                >
                    {available ? 'Add to Cart' : 'Out of Stock'}
                </button>
            </div>
        </div>
    );
};

export default ProductCard;
