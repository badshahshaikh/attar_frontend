import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header/Header';
import Shop from './pages/Shop';
import ProductDetails from './pages/ProductDetails/ProductDetails';
import Cart from './pages/Cart/Cart';
import Checkout from './pages/Checkout/Checkout';
import { CartProvider } from './context/CartContext';
import './App.css';

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <Router>
      <CartProvider>
        <div className="app">
          <Header toggleMobileMenu={toggleMobileMenu} />

          <Routes>
            <Route path="/" element={<Shop />} />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
          </Routes>

          <footer className="footer container">
            <p>© 2026 RoohAttars. Premium Fragrances. All rights reserved.</p>
          </footer>
        </div>
      </CartProvider>
    </Router>
  );
}

export default App;
