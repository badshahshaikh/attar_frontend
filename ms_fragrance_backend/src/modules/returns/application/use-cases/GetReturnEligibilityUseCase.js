import AppError from '../../../../core/errors/AppError.js';
import { toCamelOrderItem } from '../../../customer/customer.mapper.js';
import { evaluateEligibility } from '../return-policy.js';
import { logger } from '../../../../shared/logging/logger.js';

/**
 * GetReturnEligibilityUseCase - Pre-check shown before the admin creates a
 * return: is the order delivered, inside the 7-day window, and which
 * quantities per item are still returnable.
 */
class GetReturnEligibilityUseCase {
    constructor(returnsRepository) {
        this.returnsRepository = returnsRepository;
    }

    async execute(orderId) {
        try {
            const snapshot = await this.returnsRepository.findOrderForEligibility(orderId);

            if (!snapshot) {
                throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
            }

            const evaluation = evaluateEligibility({
                order: snapshot.order,
                items: snapshot.items,
                returnedByItem: snapshot.returnedByItem,
            });

            const order = snapshot.order;

            return {
                order: {
                    id: order.id,
                    orderNumber: order.order_number,
                    status: order.status,
                    total: order.total,
                    customerName: order.full_name || order.contact_name || '',
                    customerPhone: order.phone || order.contact_phone || '',
                    customerEmail: order.email || '',
                    createdAt: order.created_at,
                    deliveredAt: order.delivered_at,
                },
                eligible: evaluation.eligible,
                reason: evaluation.reason,
                deliveredAt: evaluation.deliveredAt,
                daysAfterDelivery: evaluation.daysAfterDelivery,
                daysRemaining: evaluation.daysRemaining,
                items: (snapshot.items || []).map((item) => {
                    const line = evaluation.lines.find((entry) => entry.orderItemId === Number(item.id));
                    return {
                        ...toCamelOrderItem(item),
                        alreadyReturned: line ? line.alreadyReturned : 0,
                        returnable: line ? line.returnable : 0,
                    };
                }),
            };
        } catch (error) {
            logger.error('[GET_RETURN_ELIGIBILITY_ERROR]', { orderId, errorMessage: error.message });
            throw error;
        }
    }
}

export default GetReturnEligibilityUseCase;
