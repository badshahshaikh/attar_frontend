import { toAdminOrderDetail } from '../../order.mapper.js';
import { logger } from '../../../../shared/logging/logger.js';

/**
 * UpdateOrderStatusUseCase - Business logic for an admin order status update.
 *
 * Responsibilities:
 * - Delegate the single-column update to the repository (status and/or
 *   payment_status), which touches nothing else.
 * - Map the freshly re-read order to the admin API shape, or return null when
 *   the order does not exist (the controller turns that into a 404).
 *
 * General order status and payment status are updated independently: the
 * validated payload contains at most one of them, so changing one never
 * affects the other. No stock, totals, or Razorpay state is altered here — a
 * manual payment-status change is an administrative override, never payment
 * verification (that stays in the Razorpay service/webhook flow).
 */
class UpdateOrderStatusUseCase {
    constructor(orderRepository) {
        this.orderRepository = orderRepository;
    }

    async execute(id, { status, paymentStatus, deliveredAt }) {
        try {
            const row = await this.orderRepository.updateOrderStatus(id, { status, paymentStatus, deliveredAt });
            return toAdminOrderDetail(row);
        } catch (error) {
            logger.error('[UPDATE_ORDER_STATUS_ERROR]', { orderId: id, errorMessage: error.message });
            throw error;
        }
    }
}

export default UpdateOrderStatusUseCase;
