import React, { useState } from 'react';
import Breadcrumb from '../components/Breadcrumb/Breadcrumb';
import PageHeader from '../components/PageHeader/PageHeader';
import Filters from '../components/Filters/Filters';
import Sorting from '../components/Sorting/Sorting';
import ProductGrid from '../components/ProductGrid/ProductGrid';
import { mockProducts } from '../data/mockProducts';

const Shop = () => {
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const toggleFilters = () => {
        setIsFilterOpen(!isFilterOpen);
    };

    return (
        <main>
            <Breadcrumb />
            <PageHeader />

            <section className="shop-section container">
                <div className="shop-layout">
                    <Filters isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} />

                    <div className="shop-content">
                        <Sorting toggleFilters={toggleFilters} />
                        <ProductGrid products={mockProducts} />
                    </div>
                </div>
            </section>
        </main>
    );
};

export default Shop;
