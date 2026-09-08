import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard/ProductCard';
import { useProducts } from '../context/ProductContext';
import './Shop.css';

const Shop = () => {
    const { products, loading, error } = useProducts();
    const [searchParams, setSearchParams] = useSearchParams();
    const [filteredProducts, setFilteredProducts] = useState([]);

    const searchQuery = searchParams.get('search') || '';
    const collection = searchParams.get('collection') || '';
    const brand = searchParams.get('brand') || '';

    useEffect(() => {
        let filtered = products;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(product =>
                product.name?.toLowerCase().includes(query) ||
                product.description?.toLowerCase().includes(query) ||
                product.fragranceType?.toLowerCase().includes(query)
            );
        }

        if (collection) {
            filtered = filtered.filter(product =>
                product.fragranceType === collection ||
                (collection === 'best-sellers' && product.isBestSeller) ||
                (collection === 'exclusive' && product.isExclusive)
            );
        }

        if (brand) {
            filtered = filtered.filter(product => product.brand === brand);
        }

        setFilteredProducts(filtered);
    }, [products, searchQuery, collection, brand]);

    if (loading) {
        return (
            <main className="shop-page">
                <div className="container">
                    <div className="shop-loading">Loading products...</div>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="shop-page">
                <div className="container">
                    <div className="shop-error">{error}</div>
                </div>
            </main>
        );
    }

    return (
        <main className="shop-page">
            <div className="container">
                <div className="shop-header">
                    <h1>Shop All Fragrances</h1>
                    <p>Discover our complete collection of premium attars and fragrances.</p>
                </div>

                {(searchQuery || collection || brand) && (
                    <div className="shop-filters">
                        {searchQuery && <span>Search: "{searchQuery}"</span>}
                        {collection && <span>Collection: {collection}</span>}
                        {brand && <span>Brand: {brand}</span>}
                        <button 
                            className="btn btn-outline btn-small"
                            onClick={() => setSearchParams({})}
                        >
                            Clear Filters
                        </button>
                    </div>
                )}

                {filteredProducts.length === 0 ? (
                    <div className="shop-empty">
                        <h2>No products found</h2>
                        <p>Try adjusting your filters or search terms.</p>
                    </div>
                ) : (
                    <div className="shop-grid">
                        {filteredProducts.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
};

export default Shop;
