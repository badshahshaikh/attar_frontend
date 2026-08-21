import React from 'react';
import { Heart, Eye, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWishlist } from '../../context/WishlistContext';
import './ProductCard.css';

const ProductCard = ({ product }) => {
    const { toggleWishlist, isInWishlist } = useWishlist();
    const inWishlist = isInWishlist(product.id);

    return (
        <div className="product-card group">
            <Link to={`/product/${product.id}`} className="product-image-container" style={{ display: 'block' }}>
                {product.isNew && <span className="product-badge new">New</span>}
                {product.originalPrice && <span className="product-badge sale">Sale</span>}

                <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="product-image"
                    loading="lazy"
                />

                {/* Hover Actions */}
                <div className="product-actions" onClick={(e) => e.preventDefault()}>
                    <Link to={`/product/${product.id}`} className="btn-icon" title="Quick View">
                        <Eye size={18} strokeWidth={1.5} />
                    </Link>
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

                <Link to={`/product/${product.id}`} className="btn btn-outline add-to-cart-btn" style={{ display: 'flex', justifyContent: 'center' }}>
                    Choose Options
                </Link>
            </div>
        </div>
    );
};

export default ProductCard;
