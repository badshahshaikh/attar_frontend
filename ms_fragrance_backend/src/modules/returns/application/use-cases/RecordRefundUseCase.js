import AppError from '../../../../core/errors/AppError.js';
import { toReturnDetail } from '../../return.mapper.js';
import { logger } from '../../../../shared/logging/logger.js';

/**
 * RecordRefundUseCase - Admin records a manual refund.
 *
 * Guards:
 * - The return must be in `refund_pending` (locked read).
 * - Amount must be a positive, finite number (re-checked here, not only in
 *   the request validator) and within the server-computed ceiling (sum of
 *   returned line totals).
 * - The UNIQUE(return_id) constraint makes a second refund impossible; the
 *   duplicate is surfaced as a clear 409.
 * - The return flips to terminal `refunded` in the same transaction.
 *
 * No Razorpay API is ever called here — this only records money the admin
 * already moved by hand. The order's own payment_status is never touched.
 */
class RecordRefundUseCase {
    constructor(returnsRepository, withTransaction) {
        this.returnsRepository = returnsRepository;
        this.withTransaction = withTransaction;
    }

    async execute(id, { amount, method, reference, refundedAt }, admin) {
        try {
            // Defence in depth behind the request validator: a refund amount
            // must be a positive, finite number before anything else runs.
            if (!Number.isFinite(amount) || amount <= 0) {
                throw new AppError('amount must be a positive number', 422, 'RETURN_REFUND_INVALID_AMOUNT');
            }

            await this.withTransaction(async (client) => {
                const current = await this.returnsRepository.findForUpdateTx(client, id);

                if (!current) {
                    throw new AppError('Return not found', 404, 'RETURN_NOT_FOUND');
                }

                if (current.status !== 'refund_pending') {
                    throw new AppError(
                        `A refund can only be recorded from "refund_pending" (current: "${current.status}")`,
                        422,
                        'RETURN_REFUND_WRONG_STATE'
                    );
                }

                const ceiling = await this.returnsRepository.sumReturnLinesTx(client, id);

                if (amount > ceiling) {
                    throw new AppError(
                        `Refund of ${amount} exceeds the return total of ${ceiling}`,
                        422,
                        'RETURN_REFUND_EXCEEDS_TOTAL'
                    );
                }

                try {
                    const refund = await this.returnsRepository.recordRefundTx(
                        client, id, { amount, method, reference, refundedAt }, admin
                    );

                    if (!refund) {
                        throw new AppError(
                            'The return was updated by someone else. Please reload and try again.',
                            409,
                            'RETURN_CONFLICT'
                        );
                    }
                } catch (error) {
                    if (error?.code === '23505') {
                        throw new AppError('A refund has already been recorded for this return', 409, 'RETURN_REFUND_DUPLICATE');
                    }
                    throw error;
                }
            });

            return toReturnDetail(await this.returnsRepository.findByIdAdmin(id));
        } catch (error) {
            logger.error('[RECORD_REFUND_ERROR]', { returnId: id, errorMessage: error.message });
            throw error;
        }
    }
}

export default RecordRefundUseCase;
