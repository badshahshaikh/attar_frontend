import React from 'react';
import './Breadcrumb.css';

const Breadcrumb = () => {
    return (
        <nav className="breadcrumb container">
            <ol>
                <li><a href="/">Home</a></li>
                <li className="separator">/</li>
                <li><a href="/shop">Shop</a></li>
                <li className="separator">/</li>
                <li className="active" aria-current="page">Attars</li>
            </ol>
        </nav>
    );
};

export default Breadcrumb;
