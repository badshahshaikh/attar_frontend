import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useWishlist } from '../../context/WishlistContext';
import { mockProducts } from '../../data/mockProducts';
import ProductGrid from '../../components/ProductGrid/ProductGrid';
import './Wishlist.css';

const Wishlist = () => {
    const { wishlistItems } = useWishlist();

    const wishlistProducts = mockProducts.filter(product => wishlistItems.includes(product.id));

    if (wishlistProducts.length === 0) {
        return (
            <div className="wishlist-page container empty-wishlist-container">
                <div className="empty-wishlist-content">
                    <h2>Your Wishlist is Empty</h2>
                    <p>You haven't saved any attars to your wishlist yet.</p>
                    <Link to="/" className="btn btn-primary btn-lg continue-shopping-btn">
                        <ArrowLeft size={18} /> Discover Attars
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <main className="wishlist-page container">
            <h1 className="page-title">My Wishlist</h1>
            <p className="wishlist-subtitle">You have {wishlistProducts.length} saved {wishlistProducts.length === 1 ? 'item' : 'items'}.</p>

            <div className="wishlist-grid-container">
                <ProductGrid products={wishlistProducts} />
            </div>
        </main>
    );
};

export default Wishlist;
