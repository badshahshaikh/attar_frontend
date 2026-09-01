import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../../context/ProductContext';
import './Collections.css';

const Collections = () => {
    const navigate = useNavigate();
    const { products, loading, error } = useProducts();
    const categories = [...new Set(products.map(p => p.fragranceType))];

    const getCategoryImage = (category) => {
        const product = products.find(p => p.fragranceType === category);
        return product ? product.imageUrl : '';
    };

    const handleCollectionClick = (category) => {
        navigate(`/shop?collection=${encodeURIComponent(category)}`);
    };

    if (loading) {
        return (
            <main className="collections-page container">
                <div className="text-center" style={{ padding: '60px 20px' }}>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 300, marginBottom: '16px', color: 'var(--text-color)' }}>Loading fragrances...</h2>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="collections-page container">
                <div className="text-center" style={{ padding: '60px 20px' }}>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 300, marginBottom: '16px', color: 'var(--text-color)' }}>{error}</h2>
                </div>
            </main>
        );
    }

    return (
        <main className="collections-page container">
            <h1 className="page-title text-center" style={{ marginTop: '40px', marginBottom: '10px' }}>Our Collections</h1>
            <p className="text-center" style={{ marginBottom: '50px', color: 'var(--text-light)' }}>Discover our curated selection of premium fragrance profiles.</p>

            <div className="collections-grid">
                {categories.map(category => (
                    <div
                        key={category}
                        className="collection-card"
                        onClick={() => handleCollectionClick(category)}
                    >
                        <div className="collection-img-container">
                            <img src={getCategoryImage(category)} alt={category} />
                            <div className="collection-overlay">
                                <h3>{category}</h3>
                                <span>Explore</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );
};

export default Collections;
