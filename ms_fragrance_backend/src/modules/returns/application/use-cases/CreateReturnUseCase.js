import AppError from '../../../../core/errors/AppError.js';
import { toReturnDetail } from '../../return.mapper.js';
import { evaluateEligibility } from '../return-policy.js';
import { logger } from '../../../../shared/logging/logger.js';

const RETURN_NUMBER_ATTEMPTS = 5;
const UNIQUE_VIOLATION = '23505';

function pad(value) {
    return String(value).padStart(2, '0');
}

// Return reference: RMA-YYMMDD-XXXX, mirroring the MSF- order numbers.
function buildReturnNumber(date = new Date()) {
    const stamp = [
        String(date.getFullYear()).slice(-2),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
    ].join('');
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, 'X');

    return `RMA-${stamp}-${suffix}`;
}

/**
 * CreateReturnUseCase - Admin creates a return for a delivered order.
 *
 * Server-side enforcement (never trusts the eligibility banner):
 * - Order must exist and be delivered with a recorded delivered_at.
 * - Creation must fall inside the 7-day window.
 * - Each line must belong to the order and fit the remaining per-item quota
 *   (ordered minus already returned across non-rejected returns).
 *
 * Everything runs in ONE transaction on the locked order snapshot, so two
 * admins creating returns for the same order cannot both pass the quota.
 */
class CreateReturnUseCase {
    constructor(returnsRepository, withTransaction) {
        this.returnsRepository = returnsRepository;
        this.withTransaction = withTransaction;
    }

    async execute({ orderId, items, customerReason, internalNotes }, admin) {
        try {
            const returnId = await this.withTransaction(async (client) => {
                const snapshot = await this.returnsRepository.findOrderForEligibilityTx(client, orderId);

                if (!snapshot) {
                    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
                }

                const evaluation = evaluateEligibility({
                    order: snapshot.order,
                    items: snapshot.items,
                    returnedByItem: snapshot.returnedByItem,
                });

                if (!evaluation.eligible) {
                    throw new AppError(evaluation.reason, 422, 'RETURN_NOT_ELIGIBLE');
                }

                const byOrderItem = new Map(
                    snapshot.items.map((item) => [Number(item.id), item])
                );
                const quotaByItem = new Map(
                    evaluation.lines.map((line) => [line.orderItemId, line.returnable])
                );

                const seen = new Set();

                const lines = items.map(({ orderItemId, quantity }) => {
                    // Defence in depth behind the request validator: the same
                    // order item must never appear twice in one return.
                    if (seen.has(Number(orderItemId))) {
                        throw new AppError(
                            `Order item ${orderItemId} is listed more than once`,
                            422,
                            'RETURN_ITEM_DUPLICATE'
                        );
                    }
                    seen.add(Number(orderItemId));

                    const source = byOrderItem.get(Number(orderItemId));

                    if (!source) {
                        throw new AppError(
                            `Order item ${orderItemId} does not belong to this order`,
                            422,
                            'RETURN_ITEM_MISMATCH'
                        );
                    }

                    const remaining = quotaByItem.get(Number(orderItemId)) || 0;

                    if (quantity > remaining) {
                        throw new AppError(
                            `Only ${remaining} unit(s) of "${source.product_name}" can still be returned`,
                            422,
                            'RETURN_QUANTITY_EXCEEDED'
                        );
                    }

                    const unitPrice = Number(source.unit_price);

                    return {
                        orderItemId: Number(orderItemId),
                        productId: source.product_id ?? null,
                        productName: source.product_name,
                        size: source.size || null,
                        quantity,
                        unitPrice,
                        lineTotal: Math.round(unitPrice * quantity * 100) / 100,
                    };
                });

                for (let attempt = 0; attempt < RETURN_NUMBER_ATTEMPTS; attempt += 1) {
                    try {
                        return await this.returnsRepository.createReturnTx(client, {
                            returnNumber: buildReturnNumber(),
                            orderId,
                            customerReason,
                            internalNotes,
                            deliveredAt: evaluation.deliveredAt,
                            daysAfterDelivery: evaluation.daysAfterDelivery,
                            admin,
                            lines,
                        });
                    } catch (error) {
                        if (error?.code === UNIQUE_VIOLATION && attempt < RETURN_NUMBER_ATTEMPTS - 1) {
                            continue;
                        }
                        throw error;
                    }
                }

                throw new AppError('Could not generate a return number. Please try again.', 500, 'RETURN_NUMBER_FAILED');
            });

            return toReturnDetail(await this.returnsRepository.findByIdAdmin(returnId));
        } catch (error) {
            logger.error('[CREATE_RETURN_ERROR]', { orderId, errorMessage: error.message });
            throw error;
        }
    }
}

export default CreateReturnUseCase;
export { buildReturnNumber };
