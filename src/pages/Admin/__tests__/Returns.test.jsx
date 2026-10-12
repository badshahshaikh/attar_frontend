import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

vi.mock('../../../services/adminReturnService', () => ({
    fetchReturns: vi.fn(),
    fetchReturnDetails: vi.fn(),
    checkReturnEligibility: vi.fn(),
    createReturn: vi.fn(),
    updateReturnStatus: vi.fn(),
    confirmReturnInspection: vi.fn(),
    recordRefund: vi.fn(),
}));

vi.mock('../../../services/adminOrderService', () => ({
    fetchOrders: vi.fn(),
}));

import * as returnService from '../../../services/adminReturnService';
import * as orderService from '../../../services/adminOrderService';
import Returns from '../Returns';

const listRow = {
    id: 1,
    returnNumber: 'RET-0001',
    orderId: 10,
    orderNumber: 'ORD-1001',
    status: 'requested',
    createdAt: '2026-10-01T10:00:00.000Z',
};

const listPayload = {
    returns: [listRow],
    pagination: {
        page: 1, limit: 10, totalReturns: 1, totalPages: 1,
        hasNextPage: false, hasPreviousPage: false,
    },
};

const baseDetail = {
    id: 1,
    returnNumber: 'RET-0001',
    orderId: 10,
    orderNumber: 'ORD-1001',
    status: 'requested',
    customerReason: 'Wrong scent',
    internalNotes: 'customer called',
    unopenedConfirmed: true,
    inspectedAt: null,
    deliveredAt: '2026-09-28T10:00:00.000Z',
    daysAfterDelivery: 3,
    createdByAdminName: 'admin',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    items: [
        {
            id: 100, orderItemId: 200, productId: 5, productName: 'Oud Royale',
            size: '6ml', quantity: 1, unitPrice: 499, lineTotal: 499,
            orderedQuantity: 2, stockRestored: false, restoredAt: null,
        },
    ],
    history: [],
    refund: null,
    order: {
        id: 10, orderNumber: 'ORD-1001', status: 'delivered', paymentStatus: 'paid',
        total: 998, customerName: 'Ayesha', customerPhone: '9999999999',
        deliveredAt: '2026-09-28T10:00:00.000Z',
    },
};

const openDetail = async () => {
    render(<Returns />);
    await screen.findByText('RET-0001');
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    await screen.findByRole('dialog');
};

describe('Returns admin page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        returnService.fetchReturns.mockResolvedValue(listPayload);
    });

    it('shows the loading state and then the returns list', async () => {
        render(<Returns />);

        expect(screen.getByText('Loading returns...')).toBeInTheDocument();

        await waitFor(() => expect(screen.getByText('RET-0001')).toBeInTheDocument());
        expect(screen.getByText('#ORD-1001')).toBeInTheDocument();
        // Scoped to the table — the status filter dropdown also lists "Requested".
        expect(within(screen.getByRole('table')).getByText('Requested')).toBeInTheDocument();
    });

    it('shows an empty state when the backend returns no returns', async () => {
        returnService.fetchReturns.mockResolvedValue({
            returns: [],
            pagination: { page: 1, totalPages: 0, totalReturns: 0 },
        });

        render(<Returns />);

        await screen.findByText('No returns found.');
    });

    it('shows a permission error when the list request is forbidden', async () => {
        const error = new Error('forbidden');
        error.status = 403;
        returnService.fetchReturns.mockRejectedValue(error);

        render(<Returns />);

        await screen.findByText('You do not have permission to view returns.');
    });

    it('passes the status filter to the service and resets to page 1', async () => {
        render(<Returns />);
        await screen.findByText('RET-0001');
        returnService.fetchReturns.mockClear();

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'approved' } });

        await waitFor(() =>
            expect(returnService.fetchReturns).toHaveBeenLastCalledWith({
                page: 1, limit: 10, search: '', status: 'approved',
            })
        );
    });

    it('opens the detail modal with order facts, items and workflow buttons', async () => {
        returnService.fetchReturnDetails.mockResolvedValue({ return: baseDetail });

        await openDetail();

        expect(screen.getByText('Original order')).toBeInTheDocument();
        expect(screen.getByText('Wrong scent')).toBeInTheDocument();
        expect(screen.getByText('Oud Royale')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Approve return' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reject return' })).toBeInTheDocument();
        expect(returnService.fetchReturnDetails).toHaveBeenCalledWith(1);
    });

    it('requires a note before rejecting a return', async () => {
        returnService.fetchReturnDetails.mockResolvedValue({ return: baseDetail });

        await openDetail();

        fireEvent.click(screen.getByRole('button', { name: 'Reject return' }));

        await screen.findByText('A reason is required when rejecting a return.');
        expect(returnService.updateReturnStatus).not.toHaveBeenCalled();
    });

    it('updates the status with the note and shows server-confirmed state', async () => {
        returnService.fetchReturnDetails.mockResolvedValue({ return: baseDetail });
        returnService.updateReturnStatus.mockResolvedValue({
            return: { ...baseDetail, status: 'approved' },
        });

        await openDetail();

        fireEvent.change(
            screen.getByPlaceholderText('e.g. Wrong size delivered'),
            { target: { value: 'policy allows' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Approve return' }));

        await waitFor(() =>
            expect(returnService.updateReturnStatus).toHaveBeenCalledWith(1, {
                status: 'approved',
                note: 'policy allows',
            })
        );
        await screen.findByText('Status updated to Approved.');
        // Transitions from approved replace the button set.
        expect(screen.getByRole('button', { name: 'Mark for pickup' })).toBeInTheDocument();
    });

    it('refreshes the modal header status badge after a status mutation', async () => {
        returnService.fetchReturnDetails.mockResolvedValue({ return: baseDetail });
        returnService.updateReturnStatus.mockResolvedValue({
            return: { ...baseDetail, status: 'approved' },
        });

        await openDetail();

        // Scoped to the dialog — the status filter dropdown also lists "Requested".
        expect(within(screen.getByRole('dialog')).getByText('Requested')).toBeInTheDocument();

        fireEvent.change(
            screen.getByPlaceholderText('e.g. Wrong size delivered'),
            { target: { value: 'policy allows' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Approve return' }));

        await waitFor(() =>
            expect(returnService.updateReturnStatus).toHaveBeenCalledWith(1, {
                status: 'approved',
                note: 'policy allows',
            })
        );
        // The header badge reflects the server-confirmed status immediately.
        await waitFor(() =>
            expect(within(screen.getByRole('dialog')).getByText('Approved')).toBeInTheDocument()
        );
        expect(
            within(screen.getByRole('dialog')).queryByText('Requested')
        ).not.toBeInTheDocument();
    });

    it('shows a backend conflict message when the status change is rejected', async () => {
        returnService.fetchReturnDetails.mockResolvedValue({ return: baseDetail });
        const conflict = new Error('Return status change not allowed');
        conflict.status = 409;
        returnService.updateReturnStatus.mockRejectedValue(conflict);

        await openDetail();

        fireEvent.click(screen.getByRole('button', { name: 'Approve return' }));

        await screen.findByText(/changed elsewhere/);
    });

    it('confirms inspection via same-status PATCH and reports stock restoration', async () => {
        const received = { ...baseDetail, status: 'received' };
        returnService.fetchReturnDetails.mockResolvedValue({ return: received });
        returnService.confirmReturnInspection.mockResolvedValue({
            return: {
                ...received,
                inspectedAt: '2026-10-03T10:00:00.000Z',
                stockRestored: [{ id: 1, product_id: 5, quantity: 1 }],
            },
        });

        render(<Returns />);
        await screen.findByText('RET-0001');
        fireEvent.click(screen.getByRole('button', { name: 'View' }));
        await screen.findByRole('dialog');

        expect(screen.queryByRole('button', { name: /Confirm inspection/ })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Confirm inspection/ }));

        await waitFor(() =>
            expect(returnService.confirmReturnInspection).toHaveBeenCalledWith(1, 'received')
        );
        await screen.findByText('Inspection confirmed. Stock restored for 1 line.');
        // Badge + facts section can both carry the inspected timestamp.
        expect((await screen.findAllByText(/Inspected 03 Oct 2026/)).length).toBeGreaterThan(0);
    });

    it('hides the inspection button once the return has been inspected', async () => {
        returnService.fetchReturnDetails.mockResolvedValue({
            return: { ...baseDetail, status: 'received', inspectedAt: '2026-10-03T10:00:00.000Z' },
        });

        await openDetail();

        expect(screen.queryByRole('button', { name: /Confirm inspection/ })).not.toBeInTheDocument();
    });

    it('blocks refund submission until the admin confirms verification', async () => {
        const refundPending = { ...baseDetail, status: 'refund_pending' };
        returnService.fetchReturnDetails.mockResolvedValue({ return: refundPending });

        await openDetail();

        expect(screen.getByLabelText(/Amount/)).toHaveValue(499);
        fireEvent.click(screen.getByRole('button', { name: 'Record Refund' }));

        await screen.findByText(/verified before recording/);
        expect(returnService.recordRefund).not.toHaveBeenCalled();
    });

    it('records a verified refund and shows the returned state', async () => {
        const refundPending = { ...baseDetail, status: 'refund_pending' };
        returnService.fetchReturnDetails.mockResolvedValue({ return: refundPending });
        returnService.recordRefund.mockResolvedValue({
            return: {
                ...refundPending,
                status: 'refunded',
                refundAmount: 499,
                refund: {
                    id: 9, amount: 499, method: 'manual', reference: null,
                    refundedAt: '2026-10-04T10:00:00.000Z', recordedByAdminName: 'admin',
                },
            },
        });

        await openDetail();

        fireEvent.click(screen.getByRole('checkbox', { name: /verified this refund/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Record Refund' }));

        await waitFor(() =>
            expect(returnService.recordRefund).toHaveBeenCalledWith(1, {
                amount: 499,
                method: 'manual',
            })
        );
        await screen.findByText(/Refund of ₹499 recorded\./);
        // Modal badge reflects the server-confirmed refund; the list row badge
        // (first table — the modal adds an items table) is refreshed too.
        expect(await screen.findByText('Refunded ₹499')).toBeInTheDocument();
        expect(
            within(screen.getAllByRole('table')[0]).getByText('Refunded')
        ).toBeInTheDocument();
    });

    it('creates a return through order search, eligibility and item selection', async () => {
        returnService.fetchReturns.mockResolvedValue({
            returns: [],
            pagination: { page: 1, totalPages: 0, totalReturns: 0 },
        });
        orderService.fetchOrders.mockResolvedValue({
            orders: [{
                id: 10, orderNumber: 'ORD-1001', customerName: 'Ayesha',
                customerEmail: 'a@example.com', orderDate: '2026-09-25T10:00:00.000Z',
            }],
            pagination: {},
        });
        returnService.checkReturnEligibility.mockResolvedValue({
            order: { id: 10, orderNumber: 'ORD-1001' },
            eligible: true,
            reason: null,
            deliveredAt: '2026-09-28T10:00:00.000Z',
            daysAfterDelivery: 3,
            daysRemaining: 4,
            items: [{
                id: 200, productId: 5, productName: 'Oud Royale', size: '6ml',
                quantity: 2, unitPrice: 499, lineTotal: 998,
                alreadyReturned: 0, returnable: 2,
            }],
        });
        returnService.createReturn.mockResolvedValue({
            return: { ...baseDetail, returnNumber: 'RET-0002', orderNumber: 'ORD-1001' },
        });

        render(<Returns />);
        await screen.findByText('No returns found.');
        fireEvent.click(screen.getByRole('button', { name: 'New Return' }));

        fireEvent.change(
            screen.getByPlaceholderText('Order number, email or phone'),
            { target: { value: 'ORD-1001' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Search Orders' }));

        await screen.findByText('#ORD-1001');
        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
        await screen.findByText(/3 days after delivery/);

        fireEvent.click(screen.getByRole('checkbox', { name: /Oud Royale/ }));
        // Quantity is capped at the returnable amount even if a higher value is typed.
        fireEvent.change(
            screen.getByLabelText('Quantity of Oud Royale to return'),
            { target: { value: '9' } }
        );
        fireEvent.change(
            screen.getByPlaceholderText('e.g. Customer changed their mind'),
            { target: { value: 'Wrong scent' } }
        );
        fireEvent.click(screen.getByRole('checkbox', { name: /unopened and sealed/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Create Return' }));

        await waitFor(() =>
            expect(returnService.createReturn).toHaveBeenCalledWith({
                orderId: 10,
                items: [{ orderItemId: 200, quantity: 2 }],
                customerReason: 'Wrong scent',
                internalNotes: '',
                unopenedConfirmed: true,
            })
        );
    });

    it('blocks creation when the order is not eligible', async () => {
        returnService.fetchReturns.mockResolvedValue({
            returns: [],
            pagination: { page: 1, totalPages: 0, totalReturns: 0 },
        });
        orderService.fetchOrders.mockResolvedValue({
            orders: [{
                id: 11, orderNumber: 'ORD-1002', customerName: 'Bilal',
                customerEmail: 'b@example.com', orderDate: '2026-09-25T10:00:00.000Z',
            }],
            pagination: {},
        });
        returnService.checkReturnEligibility.mockResolvedValue({
            order: { id: 11, orderNumber: 'ORD-1002' },
            eligible: false,
            reason: 'Order is not delivered yet',
            items: [],
        });

        render(<Returns />);
        fireEvent.click(screen.getByRole('button', { name: 'New Return' }));

        fireEvent.change(
            screen.getByPlaceholderText('Order number, email or phone'),
            { target: { value: 'ORD-1002' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Search Orders' }));
        await screen.findByText('#ORD-1002');
        fireEvent.click(screen.getByRole('button', { name: 'Select' }));

        await screen.findByText(/This order cannot be returned: Order is not delivered yet/);
        expect(returnService.createReturn).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: 'Create Return' })).not.toBeInTheDocument();
    });

    it('renders the order picker email and date from the real orders API fields', async () => {
        returnService.fetchReturns.mockResolvedValue({
            returns: [],
            pagination: { page: 1, totalPages: 0, totalReturns: 0 },
        });
        orderService.fetchOrders.mockResolvedValue({
            orders: [{
                id: 12, orderNumber: 'ORD-1003', customerName: '',
                customerEmail: 'c@example.com', orderDate: '2026-09-25T10:00:00.000Z',
            }],
            pagination: {},
        });

        render(<Returns />);
        await screen.findByText('No returns found.');
        fireEvent.click(screen.getByRole('button', { name: 'New Return' }));

        fireEvent.change(
            screen.getByPlaceholderText('Order number, email or phone'),
            { target: { value: 'ORD-1003' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Search Orders' }));

        const number = await screen.findByText('#ORD-1003');
        const row = number.closest('li');
        // customerName is empty, so the customerEmail fallback must render...
        expect(row.textContent).toMatch(/c@example\.com/);
        // ...alongside the formatted orderDate (previously read as createdAt → '-').
        expect(row.textContent).toMatch(/2026/);
    });
});




