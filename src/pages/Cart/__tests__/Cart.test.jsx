import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductProvider } from '../../../context/ProductContext';
import { CartProvider, useCart } from '../../../context/CartContext';
import Cart from '../Cart';
import * as productService from '../../../services/productService';

vi.mock('../../../services/productService', () => ({
    fetchProducts: vi.fn(),
    fetchProductById: vi.fn(),
    fetchProductFacets: vi.fn().mockResolvedValue({
        brands: [],
        fragranceFamilies: [],
    }),
}));

let cartDispatch;
const DispatchCapture = ({ children }) => {
    cartDispatch = useCart().dispatch;
    return children;
};

const cartItem = (overrides = {}) => ({
    productId: 74,
    name: 'Mukhallat Jahara',
    size: '12ml',
    quantity: 1,
    price: 1200,
    total: 1200,
    image: '',
    inStock: true,
    stockQuantity: 5,
    ...overrides,
});

const renderCart = (products = []) => {
    productService.fetchProducts.mockResolvedValue(products);
    return render(
        <MemoryRouter>
            <ProductProvider>
                <CartProvider>
                    <DispatchCapture>
                        <Cart />
                    </DispatchCapture>
                </CartProvider>
            </ProductProvider>
        </MemoryRouter>
    );
};

describe('Cart — canonical slug URLs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });
    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it('links a cart item to its descriptive slug-ID URL when the catalog product has a slug', async () => {
        const product = { id: 74, slug: 'mukhallat-jahara', name: 'Mukhallat Jahara' };
        productService.fetchProducts.mockResolvedValue([product]);
        productService.fetchProductById.mockResolvedValue({ id: 74, inStock: true, stockQuantity: 5 });

        renderCart([product]);
        cartDispatch({ type: 'ADD_TO_CART', payload: cartItem() });

        await waitFor(() =>
            expect(screen.getByRole('link', { name: 'Mukhallat Jahara' })).toHaveAttribute(
                'href',
                '/product/mukhallat-jahara-74'
            )
        );
    });

    it('falls back to the numeric ID (never undefined) when the catalog product has no slug', async () => {
        const product = { id: 75, name: 'No Slug Product' };
        productService.fetchProducts.mockResolvedValue([product]);
        productService.fetchProductById.mockResolvedValue({ id: 75, inStock: true, stockQuantity: 5 });

        renderCart([product]);
        cartDispatch({ type: 'ADD_TO_CART', payload: cartItem({ productId: 75, name: 'No Slug Product' }) });

        await waitFor(() =>
            expect(screen.getByRole('link', { name: 'No Slug Product' })).toHaveAttribute(
                'href',
                '/product/75'
            )
        );
    });
});
