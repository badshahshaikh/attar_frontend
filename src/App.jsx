import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PageLoader from './components/PageLoader/PageLoader';
import Header from './components/Header/Header';
import { lazy, Suspense } from 'react';

const Home = lazy(() => import('./pages/Home/Home'));

const Shop = lazy(() => import('./pages/Shop'));

// import ProductDetails from './pages/ProductDetails/ProductDetails';
// import Cart from './pages/Cart/Cart';
// import Checkout from './pages/Checkout/Checkout';
// import Wishlist from './pages/Wishlist/Wishlist';
// import Collections from './pages/Collections/Collections';
// import About from './pages/About/About';
// import Footer from './components/Footer/Footer';
import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { ProductProvider } from './context/ProductContext';
import { AuthProvider } from './context/AuthContext';
// import Login from './pages/Login/Login';
// import AdminDashboard from './pages/Admin/AdminDashboard';
// import Products from './pages/Admin/Products';
// import ProductForm from './pages/Admin/ProductForm';


const ProductDetails = lazy(() =>
  import('./pages/ProductDetails/ProductDetails')
);
const Cart = lazy(() => import('./pages/Cart/Cart'));
const Checkout = lazy(() => import('./pages/Checkout/Checkout'));
const Wishlist = lazy(() => import('./pages/Wishlist/Wishlist'));
const Collections = lazy(() => import('./pages/Collections/Collections'));
const About = lazy(() => import('./pages/About/About'));
const Footer = lazy(() => import('./components/Footer/Footer'));
const Login = lazy(() => import('./pages/Login/Login'));
const AdminDashboard = lazy(() =>
  import('./pages/Admin/AdminDashboard')
);
const Products = lazy(() => import('./pages/Admin/Products'));
const ProductForm = lazy(() =>
  import('./pages/Admin/ProductForm')
);
const BulkProducts = lazy(() => import('./pages/Admin/BulkProducts'));

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
              <div className="app">
                <Header />
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* PUBLIC WEBSITE */}
                    <Route path="/" element={<Home />} />
                    <Route path="/shop" element={<Shop />} />
                    <Route path="/product/:id" element={<ProductDetails />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/wishlist" element={<Wishlist />} />
                    <Route path="/collections" element={<Collections />} />
                    <Route path="/about" element={<About />} />

                    {/* ADMIN LOGIN */}
                    <Route path="/admin/login" element={<Login />} />

                    {/* PROTECTED ADMIN AREA */}
                    <Route element={<ProtectedRoute />}>
                      <Route path="/admin" element={<AdminDashboard />} />
                      <Route path="/admin/products" element={<Products />} />
                      <Route path="/admin/products/bulk" element={<BulkProducts />} />
                      <Route path="/admin/products/new" element={<ProductForm />} />
                      <Route path="/admin/products/:id/edit" element={<ProductForm />} />
                    </Route>
                  </Routes>

                  <Footer />
                </Suspense>


              </div>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </ProductProvider>
    </Router>
  );
}

export default App;
