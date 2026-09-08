import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PageLoader from './components/PageLoader/PageLoader';
import { lazy, Suspense } from 'react';

const Home = lazy(() => import('./pages/Home/Home'));
const Shop = lazy(() => import('./pages/Shop'));
const ProductDetails = lazy(() => import('./pages/ProductDetails/ProductDetails'));
const Cart = lazy(() => import('./pages/Cart/Cart'));
const Checkout = lazy(() => import('./pages/Checkout/Checkout'));
const Wishlist = lazy(() => import('./pages/Wishlist/Wishlist'));
const Collections = lazy(() => import('./pages/Collections/Collections'));
const About = lazy(() => import('./pages/About/About'));
const Login = lazy(() => import('./pages/Login/Login'));
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));
const Products = lazy(() => import('./pages/Admin/Products'));
const ProductForm = lazy(() => import('./pages/Admin/ProductForm'));
const BulkProducts = lazy(() => import('./pages/Admin/BulkProducts'));
const FooterSettings = lazy(() => import('./pages/Admin/FooterSettings'));

const PublicLayout = lazy(() => import('./components/layouts/PublicLayout'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));

import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { ProductProvider } from './context/ProductContext';
import { AuthProvider } from './context/AuthContext';
import { FooterProvider } from './context/FooterContext';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import './App.css';

function App() {
  return (
    <Router>
      <ScrollToTop />
      <ProductProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <FooterProvider>
                <div className="app">
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      {/* PUBLIC WEBSITE */}
                      <Route element={<PublicLayout />}>
                        <Route path="/" element={<Home />} />
                        <Route path="/shop" element={<Shop />} />
                        <Route path="/product/:id" element={<ProductDetails />} />
                        <Route path="/cart" element={<Cart />} />
                        <Route path="/checkout" element={<Checkout />} />
                        <Route path="/wishlist" element={<Wishlist />} />
                        <Route path="/collections" element={<Collections />} />
                        <Route path="/about" element={<About />} />
                      </Route>

                      {/* ADMIN LOGIN */}
                      <Route path="/admin/login" element={<Login />} />

                      {/* PROTECTED ADMIN AREA */}
                      <Route element={<ProtectedRoute />}>
                        <Route element={<AdminLayout />}>
                          <Route path="/admin" element={<AdminDashboard />} />
                          <Route path="/admin/products" element={<Products />} />
                          <Route path="/admin/products/bulk" element={<BulkProducts />} />
                          <Route path="/admin/products/new" element={<ProductForm />} />
                          <Route path="/admin/products/:id/edit" element={<ProductForm />} />
                          <Route path="/admin/footer-settings" element={<FooterSettings />} />
                        </Route>
                      </Route>
                    </Routes>
                  </Suspense>
                </div>
              </FooterProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </ProductProvider>
    </Router>
  );
}

export default App;
