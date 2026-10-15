import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../services/productService', () => ({
    fetchProducts: vi.fn(),
    deleteProduct: vi.fn(),
    deleteProducts: vi.fn(),
}));

import * as productService from '../../../services/productService';
import Products from '../Products';

const makeProduct = (id, name) => ({
    id,
    name,
    brand: 'Surrati',
    fragranceType: 'Oud',
    category: 'Oud',
    price: 999,
    inStock: true,
    stockQuantity: 5,
    imageUrl: '',
});

const pagePayload = {
    products: [makeProduct(1, 'Oud Royale'), makeProduct(2, 'Musk Classic'), makeProduct(3, 'Amber Noor')],
    pagination: {
        page: 1, limit: 10, totalProducts: 3, totalPages: 1,
        hasNextPage: false, hasPreviousPage: false,
    },
};

const renderPage = () => render(
    <MemoryRouter>
        <Products />
    </MemoryRouter>
);

const rowCheckbox = (name) => screen.getByLabelText(`Select ${name}`);
const selectAllBox = () => screen.getByLabelText('Select all products on this page');
const bulkBar = () => screen.queryByRole('toolbar', { name: 'Bulk product actions' });

describe('Products admin page — bulk selection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        productService.fetchProducts.mockResolvedValue(pagePayload);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('starts with nothing selected and hides the bulk toolbar', async () => {
        renderPage();
        await screen.findByText('Oud Royale');

        expect(rowCheckbox('Oud Royale')).not.toBeChecked();
        expect(rowCheckbox('Musk Classic')).not.toBeChecked();
        expect(bulkBar()).not.toBeInTheDocument();
    });

    it('shows the toolbar with a count when one product is selected, and clears it', async () => {
        renderPage();
        await screen.findByText('Oud Royale');

        fireEvent.click(rowCheckbox('Oud Royale'));

        expect(await screen.findByText('1 product selected')).toBeInTheDocument();
        expect(rowCheckbox('Oud Royale')).toBeChecked();

        fireEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));

        await waitFor(() => expect(bulkBar()).not.toBeInTheDocument());
        expect(rowCheckbox('Oud Royale')).not.toBeChecked();
    });

    it('select-all toggles every visible product on and off', async () => {
        renderPage();
        await screen.findByText('Oud Royale');

        fireEvent.click(selectAllBox());

        expect(await screen.findByText('3 products selected')).toBeInTheDocument();
        expect(rowCheckbox('Oud Royale')).toBeChecked();
        expect(rowCheckbox('Musk Classic')).toBeChecked();
        expect(rowCheckbox('Amber Noor')).toBeChecked();

        fireEvent.click(selectAllBox());

        await waitFor(() => expect(bulkBar()).not.toBeInTheDocument());
        expect(rowCheckbox('Oud Royale')).not.toBeChecked();
    });

    it('marks select-all as indeterminate when only some rows are selected', async () => {
        renderPage();
        await screen.findByText('Oud Royale');

        fireEvent.click(rowCheckbox('Oud Royale'));

        await screen.findByText('1 product selected');
        expect(selectAllBox()).toBePartiallyChecked();
        expect(selectAllBox()).not.toBeChecked();

        fireEvent.click(selectAllBox());
        await screen.findByText('3 products selected');
        expect(selectAllBox()).toBeChecked();
        expect(selectAllBox()).not.toBePartiallyChecked();
    });
});

describe('Products admin page — bulk delete confirmation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        productService.fetchProducts.mockResolvedValue(pagePayload);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('opens a confirmation with the count and can-cancel action, without deleting on cancel', async () => {
        renderPage();
        await screen.findByText('Oud Royale');

        fireEvent.click(rowCheckbox('Oud Royale'));
        fireEvent.click(rowCheckbox('Musk Classic'));
        fireEvent.click(screen.getByRole('button', { name: 'Delete Selected' }));

        const dialog = await screen.findByRole('alertdialog');
        expect(within(dialog).getByText('Delete 2 products?')).toBeInTheDocument();
        expect(within(dialog).getByText(/This action cannot be undone\./)).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(productService.deleteProducts).not.toHaveBeenCalled();
        // Selection survives a cancelled confirmation.
        expect(screen.getByText('2 products selected')).toBeInTheDocument();
    });

    it('deletes exactly the selected ids, clears them and reports success', async () => {
        productService.deleteProducts.mockResolvedValue({
            deletedIds: [1, 3], deletedCount: 2, notFoundIds: [],
        });
        renderPage();
        await screen.findByText('Oud Royale');

        fireEvent.click(rowCheckbox('Oud Royale'));
        fireEvent.click(rowCheckbox('Musk Classic'));
        fireEvent.click(rowCheckbox('Amber Noor'));
        fireEvent.click(screen.getByRole('button', { name: 'Delete Selected' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Confirm Delete' }));

        await waitFor(() =>
            expect(productService.deleteProducts).toHaveBeenCalledWith([1, 2, 3])
        );
        expect(await screen.findByText('Deleted 3 products.')).toBeInTheDocument();
        await waitFor(() => expect(bulkBar()).not.toBeInTheDocument());
        // The list reloads after a successful delete.
        expect(productService.fetchProducts.mock.calls.length).toBeGreaterThan(1);
    });

    it('never sends ids outside the selected set', async () => {
        productService.deleteProducts.mockResolvedValue({
            deletedIds: [2], deletedCount: 1, notFoundIds: [],
        });
        renderPage();
        await screen.findByText('Oud Royale');

        fireEvent.click(rowCheckbox('Musk Classic'));
        fireEvent.click(screen.getByRole('button', { name: 'Delete Selected' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Confirm Delete' }));

        await waitFor(() =>
            expect(productService.deleteProducts).toHaveBeenCalledWith([2])
        );
        expect(productService.deleteProduct).not.toHaveBeenCalled();
    });

    it('handles a partial miss reported by the backend', async () => {
        productService.deleteProducts.mockResolvedValue({
            deletedIds: [1], deletedCount: 1, notFoundIds: [3],
        });
        renderPage();
        await screen.findByText('Oud Royale');

        fireEvent.click(rowCheckbox('Oud Royale'));
        fireEvent.click(rowCheckbox('Amber Noor'));
        fireEvent.click(screen.getByRole('button', { name: 'Delete Selected' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Confirm Delete' }));

        expect(await screen.findByText(
            'Deleted 1 product. 1 selected product was no longer found.'
        )).toBeInTheDocument();
        await waitFor(() => expect(bulkBar()).not.toBeInTheDocument());
    });

    it('shows an error, keeps the selection and allows retrying when the request fails', async () => {
        productService.deleteProducts.mockRejectedValue(
            Object.assign(new Error('Failed to delete products.'), { status: 500 })
        );
        renderPage();
        await screen.findByText('Oud Royale');

        fireEvent.click(rowCheckbox('Oud Royale'));
        fireEvent.click(screen.getByRole('button', { name: 'Delete Selected' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Confirm Delete' }));

        expect(await screen.findByText('Failed to delete products.')).toBeInTheDocument();
        expect(screen.getByText('1 product selected')).toBeInTheDocument();
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

        // Retry after failure is possible.
        productService.deleteProducts.mockResolvedValue({
            deletedIds: [1], deletedCount: 1, notFoundIds: [],
        });
        fireEvent.click(screen.getByRole('button', { name: 'Delete Selected' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Confirm Delete' }));

        await waitFor(() =>
            expect(productService.deleteProducts).toHaveBeenCalledTimes(2)
        );
    });

    it('disables the confirm button while a deletion is in flight', async () => {
        let resolveDelete;
        productService.deleteProducts.mockReturnValue(
            new Promise((resolve) => { resolveDelete = resolve; })
        );
        renderPage();
        await screen.findByText('Oud Royale');

        fireEvent.click(rowCheckbox('Oud Royale'));
        fireEvent.click(screen.getByRole('button', { name: 'Delete Selected' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Confirm Delete' }));

        const busyButton = await screen.findByRole('button', { name: 'Deleting...' });
        expect(busyButton).toBeDisabled();

        resolveDelete({ deletedIds: [1], deletedCount: 1, notFoundIds: [] });
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    });
});

describe('Products admin page — existing behaviour preserved', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        productService.fetchProducts.mockResolvedValue(pagePayload);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('keeps the existing single-product delete flow working', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        productService.deleteProduct.mockResolvedValue({ message: 'Product deleted' });
        renderPage();
        await screen.findByText('Oud Royale');

        fireEvent.click(within(
            rowCheckbox('Oud Royale').closest('tr')
        ).getByRole('button', { name: 'Delete' }));

        await waitFor(() =>
            expect(productService.deleteProduct).toHaveBeenCalledWith(1)
        );
        expect(productService.deleteProducts).not.toHaveBeenCalled();
    });

    it('keeps the Edit links working for every row', async () => {
        renderPage();
        await screen.findByText('Oud Royale');

        const editLinks = screen.getAllByRole('link', { name: 'Edit' });
        expect(editLinks).toHaveLength(3);
        expect(editLinks[0]).toHaveAttribute('href', '/admin/products/1/edit');
        expect(editLinks[2]).toHaveAttribute('href', '/admin/products/3/edit');
    });
});