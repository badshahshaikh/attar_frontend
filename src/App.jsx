import React, { useState } from 'react';
import Header from './components/Header/Header';
import Breadcrumb from './components/Breadcrumb/Breadcrumb';
import PageHeader from './components/PageHeader/PageHeader';
import Filters from './components/Filters/Filters';
import Sorting from './components/Sorting/Sorting';
import ProductGrid from './components/ProductGrid/ProductGrid';
import { mockProducts } from './data/mockProducts';
import './App.css';

function App() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleFilters = () => {
    setIsFilterOpen(!isFilterOpen);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="app">
      <Header toggleMobileMenu={toggleMobileMenu} />

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

      <footer className="footer container">
        <p>© 2026 RoohAttars. Premium Fragrances. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
