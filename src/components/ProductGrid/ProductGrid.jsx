import React from 'react';
import ProductCard from '../ProductCard/ProductCard';
import './ProductGrid.css';

const ProductGrid = ({ products }) => {
    return (
        <div className="product-grid-container">
            <div className="product-grid">
                {products.map(product => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </div>

            <div className="pagination-container">
                <button className="btn btn-outline load-more-btn">
                    Load More
                </button>
            </div>
        </div>
    );
};

export default ProductGrid;
