import { toAdminOrderDetail } from '../../order.mapper.js';
import { generateInvoicePdf } from '../../invoice/invoice.generator.js';
import { invoiceFilename } from '../../invoice/invoice.util.js';
import { logger } from '../../../../shared/logging/logger.js';

/**
 * GenerateInvoiceUseCase - Builds the invoice PDF for an order.
 *
 * Responsibilities:
 * - Load the order through the SAME repository query used by the admin View
 *   action (findByIdAdmin) and map it with the SAME toAdminOrderDetail mapper,
 *   so the invoice can never diverge from the order detail the admin already
 *   sees and never trusts frontend-supplied data.
 * - Render it to a PDF buffer and derive a stable download filename.
 * - Return null when the order does not exist (the controller turns that into
 *   a 404).
 *
 * Read-only: it never mutates the order, stock, payment status, or totals.
 */
class GenerateInvoiceUseCase {
    constructor(orderRepository, invoiceGenerator = generateInvoicePdf) {
        this.orderRepository = orderRepository;
        this.invoiceGenerator = invoiceGenerator;
    }

    async execute(id) {
        try {
            const row = await this.orderRepository.findByIdAdmin(id);
            if (!row) return null;

            const order = toAdminOrderDetail(row);
            const pdf = await this.invoiceGenerator(order);

            return { pdf, filename: invoiceFilename(order.orderNumber) };
        } catch (error) {
            logger.error('[INVOICE_GENERATE_ERROR]', { orderId: id, errorMessage: error.message });
            throw error;
        }
    }
}

export default GenerateInvoiceUseCase;
