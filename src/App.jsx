import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header/Header';
import Home from './pages/Home/Home';
import Shop from './pages/Shop';
import ProductDetails from './pages/ProductDetails/ProductDetails';
import Cart from './pages/Cart/Cart';
import Checkout from './pages/Checkout/Checkout';
import Wishlist from './pages/Wishlist/Wishlist';
import Collections from './pages/Collections/Collections';
import About from './pages/About/About';
import Footer from './components/Footer/Footer';
import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { ProductProvider } from './context/ProductContext';
import './App.css';

function App() {
  return (
    <Router>
      <ScrollToTop />
      <ProductProvider>
        <CartProvider>
          <WishlistProvider>
            <div className="app">
              <Header />

              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/product/:id" element={<ProductDetails />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/collections" element={<Collections />} />
                <Route path="/about" element={<About />} />
              </Routes>

              <Footer />
            </div>
          </WishlistProvider>
        </CartProvider>
      </ProductProvider>
    </Router>
  );
}

export default App;
