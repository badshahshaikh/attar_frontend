import React from 'react';
import { Heart, Eye, Star } from 'lucide-react';
import './ProductCard.css';

const ProductCard = ({ product }) => {
    return (
        <div className="product-card group">
            <div className="product-image-container">
                {product.isNew && <span className="product-badge new">New</span>}
                {product.originalPrice && <span className="product-badge sale">Sale</span>}

                <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="product-image"
                    loading="lazy"
                />

                {/* Hover Actions */}
                <div className="product-actions">
                    <button className="btn-icon" title="Quick View">
                        <Eye size={18} strokeWidth={1.5} />
                    </button>
                    <button className="btn-icon" title="Add to Wishlist">
                        <Heart size={18} strokeWidth={1.5} />
                    </button>
                </div>
            </div>

            <div className="product-info">
                <div className="product-meta">
                    <span className="product-type">{product.fragranceType}</span>
                    <div className="product-rating">
                        <Star size={12} fill="currentColor" strokeWidth={0} className="star-icon" />
                        <span>{product.rating}</span>
                    </div>
                </div>

                <h3 className="product-title">
                    <a href="#">{product.name}</a>
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

                <button className="btn btn-outline add-to-cart-btn">
                    Add to Cart
                </button>
            </div>
        </div>
    );
};

export default ProductCard;
