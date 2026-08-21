import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header/Header';
import Shop from './pages/Shop';
import ProductDetails from './pages/ProductDetails/ProductDetails';
import './App.css';

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <Router>
      <div className="app">
        <Header toggleMobileMenu={toggleMobileMenu} />

        <Routes>
          <Route path="/" element={<Shop />} />
          <Route path="/product/:id" element={<ProductDetails />} />
        </Routes>

        <footer className="footer container">
          <p>© 2026 RoohAttars. Premium Fragrances. All rights reserved.</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
