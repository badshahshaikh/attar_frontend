import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header/Header';
import Shop from './pages/Shop';
import ProductDetails from './pages/ProductDetails/ProductDetails';
import Cart from './pages/Cart/Cart';
import Checkout from './pages/Checkout/Checkout';
import Wishlist from './pages/Wishlist/Wishlist';
import Collections from './pages/Collections/Collections';
import About from './pages/About/About';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import './App.css';

function App() {
  return (
    <Router>
      <CartProvider>
        <WishlistProvider>
          <div className="app">
            <Header />

            <Routes>
              <Route path="/" element={<Shop />} />
              <Route path="/product/:id" element={<ProductDetails />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/collections" element={<Collections />} />
              <Route path="/about" element={<About />} />
            </Routes>

            <footer className="footer container">
              <p>© 2026 RoohAttars. Premium Fragrances. All rights reserved.</p>
            </footer>
          </div>
        </WishlistProvider>
      </CartProvider>
    </Router>
  );
}

export default App;
