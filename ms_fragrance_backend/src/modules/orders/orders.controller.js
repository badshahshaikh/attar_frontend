import { parseOrderListQuery, parseOrderIdParam, parseOrderStatusUpdate } from './orders.validator.js';
import { logger } from '../../shared/logging/logger.js';

/**
 * Orders controller - Presentation layer for the admin orders endpoints.
 * Mirrors the users/products controller conventions.
 */
function createOrdersController({ getOrdersUseCase, getOrderByIdUseCase, updateOrderStatusUseCase, generateInvoiceUseCase }) {
    return {
        async list(req, res) {
            try {
                const filters = parseOrderListQuery(req.query);
                const result = await getOrdersUseCase.execute(filters);
                res.json(result);
            } catch (error) {
                logger.error('[ORDER_LIST_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to fetch orders';
                res.status(statusCode).json({ error: message });
            }
        },

        async getById(req, res) {
            const id = parseOrderIdParam(req.params.id);

            if (!id) {
                return res.status(400).json({ error: 'Order ID must be a positive integer' });
            }

            try {
                const order = await getOrderByIdUseCase.execute(id);

                if (!order) {
                    return res.status(404).json({ error: 'Order not found' });
                }

                res.json({ order });
            } catch (error) {
                logger.error('[ORDER_DETAIL_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to fetch order';
                res.status(statusCode).json({ error: message });
            }
        },

        // Update one status field at a time. The route already enforces admin
        // auth; here we validate the id + body (400), then update (404 when the
        // order is missing) and return the freshly mapped order.
        async updateStatus(req, res) {
            const id = parseOrderIdParam(req.params.id);

            if (!id) {
                return res.status(400).json({ error: 'Order ID must be a positive integer' });
            }

            let update;
            try {
                update = parseOrderStatusUpdate(req.body);
            } catch (error) {
                logger.warn('[ORDER_STATUS_UPDATE_INVALID]', { orderId: id, errorMessage: error.message });
                return res.status(400).json({ error: error.message });
            }

            try {
                const order = await updateOrderStatusUseCase.execute(id, update);

                if (!order) {
                    return res.status(404).json({ error: 'Order not found' });
                }

                res.json({ order });
            } catch (error) {
                logger.error('[ORDER_STATUS_UPDATE_ERROR]', { orderId: id, errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to update order status';
                res.status(statusCode).json({ error: message });
            }
        },

        // Generate + stream the order invoice as a downloadable PDF. Admin auth
        // is enforced by the route. Read-only: validation (400), missing order
        // (404), then a real application/pdf body with a descriptive filename.
        // Errors never leak a stack trace or DB details.
        async invoice(req, res) {
            const id = parseOrderIdParam(req.params.id);

            if (!id) {
                return res.status(400).json({ error: 'Order ID must be a positive integer' });
            }

            try {
                const result = await generateInvoiceUseCase.execute(id);

                if (!result) {
                    return res.status(404).json({ error: 'Order not found' });
                }

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
                res.setHeader('Content-Length', result.pdf.length);
                return res.send(result.pdf);
            } catch (error) {
                logger.error('[ORDER_INVOICE_ERROR]', { orderId: id, errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to generate invoice';
                return res.status(statusCode).json({ error: message });
            }
        }
    };
}

export { createOrdersController };