import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import {
    MemoryRouter,
    Routes,
    Route,
    useLocation,
} from 'react-router-dom';
import { ProductProvider } from '../../../context/ProductContext';
import { CartProvider } from '../../../context/CartContext';
import { WishlistProvider } from '../../../context/WishlistContext';
import ProductDetails from '../ProductDetails';
import * as productService from '../../../services/productService';

vi.mock('../../../services/productService', () => ({
    fetchProducts: vi.fn(),
    fetchProductById: vi.fn(),
    fetchProductFacets: vi.fn().mockResolvedValue({
        brands: [],
        fragranceFamilies: [],
    }),
}));

// Captures the router location so we can assert the browser URL after redirects.
let capturedLocation;
const LocationCapture = () => {
    capturedLocation = useLocation();
    return null;
};

const productWithSlug = {
    id: 74,
    slug: 'mukhallat-jahara',
    name: 'Mukhallat Jahara',
    fragranceType: 'Oud',
    price: 1200,
    sizePricing: { '12ml': 1200 },
    sizes: ['12ml'],
    stockQuantity: 5,
    inStock: true,
    imageUrl: '',
    imageUrls: [],
    description: 'A rich oud attar.',
    fullDescription: 'Full experience of Mukhallat Jahara.',
    topNotes: ['rose'],
    heartNotes: ['musk'],
    baseNotes: ['oud'],
    longevity: '8h',
};

const productWithoutSlug = {
    ...productWithSlug,
    id: 75,
    slug: undefined,
    name: 'No Slug Product',
};

const renderDetails = (initialEntry, products = []) => {
    productService.fetchProducts.mockResolvedValue(products);
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <LocationCapture />
            <ProductProvider>
                <CartProvider>
                    <WishlistProvider>
                        <Routes>
                            <Route
                                path="/product/:slugId"
                                element={<ProductDetails />}
                            />
                        </Routes>
                    </WishlistProvider>
                </CartProvider>
            </ProductProvider>
        </MemoryRouter>
    );
};

describe('ProductDetails — descriptive slug URLs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        capturedLocation = undefined;
    });
    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it('loads the correct product when opening a descriptive URL directly', async () => {
        productService.fetchProductById.mockResolvedValue(productWithSlug);
        renderDetails('/product/mukhallat-jahara-74', []);

        await waitFor(() =>
            expect(screen.getByRole('heading', { name: 'Mukhallat Jahara' })).toBeInTheDocument()
        );
        expect(capturedLocation.pathname).toBe('/product/mukhallat-jahara-74');
    });

    it('redirects an uncached legacy numeric URL to the canonical descriptive URL', async () => {
        productService.fetchProductById.mockResolvedValue(productWithSlug);
        renderDetails('/product/74', []);

        await waitFor(() =>
            expect(capturedLocation.pathname).toBe('/product/mukhallat-jahara-74')
        );
        await waitFor(() =>
            expect(screen.getByRole('heading', { name: 'Mukhallat Jahara' })).toBeInTheDocument()
        );
    });

    it('does not rewrite a valid descriptive URL back to a numeric URL', async () => {
        productService.fetchProductById.mockResolvedValue(productWithSlug);
        renderDetails('/product/mukhallat-jahara-74', []);

        await waitFor(() =>
            expect(screen.getByRole('heading', { name: 'Mukhallat Jahara' })).toBeInTheDocument()
        );
        expect(capturedLocation.pathname).toBe('/product/mukhallat-jahara-74');
        expect(capturedLocation.pathname).not.toMatch(/^\/product\/\d+$/);
    });

    it('handles a product without a slug safely without producing an undefined URL', async () => {
        productService.fetchProductById.mockResolvedValue(productWithoutSlug);
        renderDetails('/product/75', []);

        await waitFor(() =>
            expect(screen.getByRole('heading', { name: 'No Slug Product' })).toBeInTheDocument()
        );
        // The URL must stay numeric and never contain 'undefined'.
        expect(capturedLocation.pathname).toBe('/product/75');
        expect(capturedLocation.pathname).not.toContain('undefined');
    });
});
