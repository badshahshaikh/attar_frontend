import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WishlistProvider } from '../../../context/WishlistContext';
import { CartProvider } from '../../../context/CartContext';
import ProductCard from '../ProductCard';

const baseProduct = {
    id: 74,
    name: 'Mukhallat Jahara',
    fragranceType: 'Oud',
    rating: 5,
    price: 1200,
    originalPrice: 1500,
    sizes: ['12ml', '24ml'],
    sizePricing: { '12ml': 1200, '24ml': 2200 },
    stockQuantity: 5,
    inStock: true,
    isNew: false,
    imageUrl: '',
    imageUrls: [],
    description: 'A rich oud attar.',
};

const renderCard = (product) => render(
    <MemoryRouter>
        <WishlistProvider>
            <CartProvider>
                <ProductCard product={product} />
            </CartProvider>
        </WishlistProvider>
    </MemoryRouter>
);

describe('ProductCard — canonical slug URLs', () => {
    beforeEach(() => { localStorage.clear(); });
    afterEach(() => { localStorage.clear(); });

    it('renders a descriptive slug-ID URL when the product has a slug', () => {
        renderCard({ ...baseProduct, slug: 'mukhallat-jahara' });

        const links = screen.getAllByRole('link', { name: 'Mukhallat Jahara' });
        expect(links.length).toBeGreaterThan(0);
        links.forEach((link) => {
            expect(link).toHaveAttribute('href', '/product/mukhallat-jahara-74');
        });
    });

    it('falls back to the numeric ID and never renders undefined when the product has no slug', () => {
        renderCard({ ...baseProduct }); // no slug

        const links = screen.getAllByRole('link', { name: 'Mukhallat Jahara' });
        expect(links.length).toBeGreaterThan(0);
        links.forEach((link) => {
            expect(link).toHaveAttribute('href', '/product/74');
            expect(link).not.toHaveAttribute('href', '/product/undefined-74');
            expect(link).not.toHaveAttribute('href', '/product/-74');
        });
    });
});
