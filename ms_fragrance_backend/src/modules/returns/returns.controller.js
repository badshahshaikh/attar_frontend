import {
    parseReturnListQuery,
    parseEligibilityQuery,
    parseReturnIdParam,
    parseCreateReturn,
    parseReturnStatusUpdate,
    parseRecordRefund,
} from './returns.validator.js';
import { logger } from '../../shared/logging/logger.js';

/**
 * Returns controller - Presentation layer for the admin returns endpoints.
 * Mirrors the orders controller conventions: 400 on invalid input, 404 when
 * the record is missing, operational messages surfaced, internals hidden.
 */
function createReturnsController({
    getReturnsUseCase,
    getReturnByIdUseCase,
    getReturnEligibilityUseCase,
    createReturnUseCase,
    updateReturnStatusUseCase,
    recordRefundUseCase,
}) {
    const adminOf = (req) => ({
        id: req.user?.id ?? null,
        name: req.user?.username || req.user?.email || 'Admin',
    });

    return {
        async list(req, res) {
            let filters;
            try {
                filters = parseReturnListQuery(req.query);
            } catch (error) {
                return res.status(400).json({ error: error.message });
            }

            try {
                res.json(await getReturnsUseCase.execute(filters));
            } catch (error) {
                logger.error('[RETURN_LIST_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to fetch returns';
                res.status(statusCode).json({ error: message });
            }
        },

        async eligibility(req, res) {
            let parsed;
            try {
                parsed = parseEligibilityQuery(req.query);
            } catch (error) {
                return res.status(400).json({ error: error.message });
            }

            try {
                res.json(await getReturnEligibilityUseCase.execute(parsed.orderId));
            } catch (error) {
                logger.error('[RETURN_ELIGIBILITY_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to check eligibility';
                res.status(statusCode).json({ error: message });
            }
        },

        async getById(req, res) {
            const id = parseReturnIdParam(req.params.id);

            if (!id) {
                return res.status(400).json({ error: 'Return ID must be a positive integer' });
            }

            try {
                const record = await getReturnByIdUseCase.execute(id);

                if (!record) {
                    return res.status(404).json({ error: 'Return not found' });
                }

                res.json({ return: record });
            } catch (error) {
                logger.error('[RETURN_DETAIL_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to fetch return';
                res.status(statusCode).json({ error: message });
            }
        },

        async create(req, res) {
            let payload;
            try {
                payload = parseCreateReturn(req.body);
            } catch (error) {
                logger.warn('[RETURN_CREATE_INVALID]', { errorMessage: error.message });
                return res.status(400).json({ error: error.message });
            }

            try {
                const record = await createReturnUseCase.execute(payload, adminOf(req));
                res.status(201).json({ return: record });
            } catch (error) {
                logger.error('[RETURN_CREATE_ERROR]', { errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to create return';
                res.status(statusCode).json({ error: message });
            }
        },

        async updateStatus(req, res) {
            const id = parseReturnIdParam(req.params.id);

            if (!id) {
                return res.status(400).json({ error: 'Return ID must be a positive integer' });
            }

            let update;
            try {
                update = parseReturnStatusUpdate(req.body);
            } catch (error) {
                logger.warn('[RETURN_STATUS_UPDATE_INVALID]', { returnId: id, errorMessage: error.message });
                return res.status(400).json({ error: error.message });
            }

            try {
                const record = await updateReturnStatusUseCase.execute(id, update, adminOf(req));

                if (!record) {
                    return res.status(404).json({ error: 'Return not found' });
                }

                res.json({ return: record });
            } catch (error) {
                logger.error('[RETURN_STATUS_UPDATE_ERROR]', { returnId: id, errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to update return status';
                res.status(statusCode).json({ error: message });
            }
        },

        async recordRefund(req, res) {
            const id = parseReturnIdParam(req.params.id);

            if (!id) {
                return res.status(400).json({ error: 'Return ID must be a positive integer' });
            }

            let refund;
            try {
                refund = parseRecordRefund(req.body);
            } catch (error) {
                logger.warn('[RETURN_REFUND_INVALID]', { returnId: id, errorMessage: error.message });
                return res.status(400).json({ error: error.message });
            }

            try {
                const record = await recordRefundUseCase.execute(id, refund, adminOf(req));
                res.json({ return: record });
            } catch (error) {
                logger.error('[RETURN_REFUND_ERROR]', { returnId: id, errorMessage: error.message });
                const statusCode = error.statusCode || 500;
                const message = error.isOperational ? error.message : 'Failed to record refund';
                res.status(statusCode).json({ error: message });
            }
        },
    };
}

export { createReturnsController };
