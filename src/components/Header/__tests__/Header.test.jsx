import { describe, it, expect, vi, beforeEach, afterEach, waitFor, act } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductProvider } from '../../../context/ProductContext';
import { CartProvider } from '../../../context/CartContext';
import { WishlistProvider } from '../../../context/WishlistContext';
import { CustomerAuthProvider } from '../../../context/CustomerAuthContext';
import Header from '../Header';
import * as productService from '../../../services/productService';
import * as customerService from '../../../services/customerService';

vi.mock('../../../services/productService', () => ({
    fetchProducts: vi.fn(),
    fetchProductFacets: vi.fn().mockResolvedValue({
        brands: [],
        fragranceFamilies: [],
    }),
}));
vi.mock('../../../services/customerService', () => ({
    fetchCustomer: vi.fn().mockResolvedValue(null),
}));

const renderHeader = () => render(
    <MemoryRouter>
        <ProductProvider>
            <CartProvider>
                <WishlistProvider>
                    <CustomerAuthProvider>
                        <Header />
                    </CustomerAuthProvider>
                </WishlistProvider>
            </CartProvider>
        </ProductProvider>
    </MemoryRouter>
);

describe('Header search — canonical slug URLs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        vi.useRealTimers();
    });

    it('opens a descriptive slug-ID URL when a product is selected from search', async () => {
        productService.fetchProducts.mockResolvedValue({
            products: [{
                id: 74,
                slug: 'mukhallat-jahara',
                name: 'Mukhallat Jahara',
                imageUrl: '',
                price: 1200,
            }],
        });

        renderHeader();

        // Open the search overlay so the input is rendered.
        fireEvent.click(screen.getByRole('button', { name: 'Search' }));

        const input = screen.getByPlaceholderText(/search premium attars/i);
        fireEvent.input(input, { target: { value: 'mukhallat' } });
        act(() => { vi.advanceTimersByTime(300); });

        await waitFor(() =>
            expect(screen.getByText('Mukhallat Jahara')).toBeInTheDocument()
        );

        const link = screen.getByRole('link', { name: 'Mukhallat Jahara' });
        expect(link).toHaveAttribute('href', '/product/mukhallat-jahara-74');
    });
});
