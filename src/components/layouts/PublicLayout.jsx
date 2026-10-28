import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../Header/Header';
import Footer from '../Footer/Footer';
import SeoHead from '../Seo/SeoHead';

const PublicLayout = () => {
    return (
        <>
            <SeoHead />
            <Header />
            <Outlet />
            <Footer />
        </>
    );
};

export default PublicLayout;
