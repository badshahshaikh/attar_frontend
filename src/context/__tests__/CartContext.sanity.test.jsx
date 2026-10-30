import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CartProvider, useCart } from '../CartContext';

const Child = () => {
    const { dispatch } = useCart();
    return <span data-dispatch={typeof dispatch}>child</span>;
};

describe('CartContext sanity', () => {
    it('provides dispatch to children', () => {
        render(
            <CartProvider>
                <Child />
            </CartProvider>
        );
        expect(screen.getByText('child')).toHaveAttribute('data-dispatch', 'function');
    });
});
