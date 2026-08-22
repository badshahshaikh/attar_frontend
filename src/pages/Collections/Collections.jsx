import React from 'react';
import { useNavigate } from 'react-router-dom';
import { mockProducts } from '../../data/mockProducts';
import './Collections.css';

const Collections = () => {
    const navigate = useNavigate();
    const categories = [...new Set(mockProducts.map(p => p.fragranceType))];

    const getCategoryImage = (category) => {
        const product = mockProducts.find(p => p.fragranceType === category);
        return product ? product.imageUrl : '';
    };

    const handleCollectionClick = (category) => {
        navigate(`/?collection=${encodeURIComponent(category)}`);
    };

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
