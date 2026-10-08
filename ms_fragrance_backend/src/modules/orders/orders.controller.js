import { parseOrderListQuery, parseOrderIdParam } from './orders.validator.js';
import { logger } from '../../shared/logging/logger.js';

/**
 * Orders controller - Presentation layer for the admin orders endpoints.
 * Mirrors the users/products controller conventions.
 */
function createOrdersController({ getOrdersUseCase, getOrderByIdUseCase }) {
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
        }
    };
}

export { createOrdersController };