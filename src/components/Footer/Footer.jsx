import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
    return (
        <footer className="site-footer">
            <div className="container footer-container">
                <div className="footer-grid">

                    {/* Brand Section */}
                    <div className="footer-brand">
                        <Link to="/" className="footer-logo">
                            <img src="/ms-fragrance-logo" alt="MS Fragrance" />
                        </Link>
                        <p className="brand-description">
                            The art of pure, non-alcoholic perfumery. We source the finest natural ingredients to craft timeless fragrance experiences for the modern connoisseur.
                        </p>
                    </div>

                    {/* Navigation 1 */}
                    <div className="footer-links">
                        <h4 className="footer-title">Explore</h4>
                        <ul>
                            <li><Link to="/">Shop All</Link></li>
                            <li><Link to="/collections">Collections</Link></li>
                            <li><Link to="/about">Our Story</Link></li>
                        </ul>
                    </div>

                    {/* Navigation 2 */}
                    <div className="footer-links">
                        <h4 className="footer-title">Customer Care</h4>
                        <ul>
                            <li><Link to="/cart">My Cart</Link></li>
                            <li><Link to="/wishlist">Wishlist</Link></li>
                            <li><a href="mailto:hello@rooh-attars.com">Contact Us</a></li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div className="footer-links">
                        <h4 className="footer-title">Get in Touch</h4>
                        <ul className="footer-contact">
                            <li>WhatsApp: <a href="https://wa.me/919876543210">+91 98765 43210</a></li>
                            <li>Email: <a href="mailto:hello@rooh-attars.com">hello@rooh-attars.com</a></li>
                            <li className="footer-hours">Mon - Sat, 10am - 7pm IST</li>
                        </ul>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p>© {new Date().getFullYear()} MS Fragrance. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
