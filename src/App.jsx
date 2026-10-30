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
const CustomerLogin = lazy(() => import('./pages/Account/Login'));
const CustomerRegister = lazy(() => import('./pages/Account/Register'));
const Account = lazy(() => import('./pages/Account/Account'));
const Login = lazy(() => import('./pages/Login/Login'));
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));
const Products = lazy(() => import('./pages/Admin/Products'));
const ProductForm = lazy(() => import('./pages/Admin/ProductForm'));
const BulkProducts = lazy(() => import('./pages/Admin/BulkProducts'));
const FooterSettings = lazy(() => import('./pages/Admin/FooterSettings'));
const Brands = lazy(() => import('./pages/Admin/Brands'));
const Categories = lazy(() => import('./pages/Admin/Categories'));
const Customers = lazy(() => import('./pages/Admin/Customers'));
const Orders = lazy(() => import('./pages/Admin/Orders'));
const Returns = lazy(() => import('./pages/Admin/Returns'));
const SeoSettings = lazy(() => import('./pages/Admin/SeoSettings'));

const PublicLayout = lazy(() => import('./components/layouts/PublicLayout'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));

import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { ProductProvider } from './context/ProductContext';
import { AuthProvider } from './context/AuthContext';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import { FooterProvider } from './context/FooterContext';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import CustomerRoute from './components/ProtectedRoute/CustomerRoute';
import './App.css';

function App() {
  return (
    <Router>
      <ScrollToTop />
      <ProductProvider>
        <AuthProvider>
          <CustomerAuthProvider>
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
                          <Route path="/product/:slugId" element={<ProductDetails />} />
                          <Route path="/cart" element={<Cart />} />
                          <Route path="/checkout" element={<Checkout />} />
                          <Route path="/wishlist" element={<Wishlist />} />
                          <Route path="/collections" element={<Collections />} />
                          <Route path="/about" element={<About />} />
                          {/* Customer account - requires a customer session */}
                          <Route element={<CustomerRoute />}>
                            <Route path="/account" element={<Account />} />
                          </Route>
                        </Route>

                        {/* CUSTOMER AUTH - standalone, like the admin portal */}
                        <Route path="/login" element={<CustomerLogin />} />
                        <Route path="/register" element={<CustomerRegister />} />

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
                            <Route path="/admin/brands" element={<Brands />} />
                            <Route path="/admin/categories" element={<Categories />} />
                            <Route path="/admin/customers" element={<Customers />} />
                            <Route path="/admin/orders" element={<Orders />} />
                            <Route path="/admin/returns" element={<Returns />} />
                            <Route path="/admin/seo" element={<SeoSettings />} />
                            <Route path="/admin/footer-settings" element={<FooterSettings />} />
                          </Route>
                        </Route>
                      </Routes>
                    </Suspense>
                  </div>
                </FooterProvider>
              </WishlistProvider>
            </CartProvider>
          </CustomerAuthProvider>
        </AuthProvider>
      </ProductProvider>
    </Router>
  );
}

export default App;
