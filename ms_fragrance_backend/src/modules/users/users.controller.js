import { parseCustomerListQuery } from './users.validator.js';
import { logger } from '../../shared/logging/logger.js';

/**
 * Users controller - Presentation layer for the registered users (customers)
 * admin endpoint. Mirrors the products controller conventions.
 */
function createUsersController({ getCustomersUseCase }) {
    return {
        async list(req, res) {
            try {
                const filters = parseCustomerListQuery(req.query);
                const result = await getCustomersUseCase.execute(filters);
                res.json(result);
            } catch (error) {
                logger.error('[CUSTOMER_LIST_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to fetch customers';
                res.status(statusCode).json({ error: message });
            }
        }
    };
}

export { createUsersController };