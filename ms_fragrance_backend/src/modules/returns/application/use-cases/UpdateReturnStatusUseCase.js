import AppError from '../../../../core/errors/AppError.js';
import { RETURN_TERMINAL_STATUSES } from '../../returns.constants.js';
import { toReturnDetail } from '../../return.mapper.js';
import { isAllowedReturnTransition } from '../../returns.validator.js';
import { logger } from '../../../../shared/logging/logger.js';

/**
 * UpdateReturnStatusUseCase - Admin moves a return through the workflow.
 *
 * Guards:
 * - Only legal transitions (RETURN_TRANSITIONS) are accepted; a same-status
 *   call is valid only as an explicit inspection confirmation.
 * - `refunded` can never be set here — only the refund endpoint produces it.
 * - `rejected` requires a reason, recorded on the history entry.
 * - Terminal returns (`refunded`, `closed`) can never be moved again.
 * - Stock is NEVER restored by a status change alone (approval, or `received`
 *   without confirmation). Restoration requires the admin's explicit
 *   `inspected` flag, which is validated here, rejected for ineligible or
 *   already-inspected returns, persisted as `returns.inspected_at`, and only
 *   then used to restore stock — all inside one transaction. `restoreStockTx`
 *   independently re-checks the persisted confirmation.
 */
class UpdateReturnStatusUseCase {
    constructor(returnsRepository, withTransaction) {
        this.returnsRepository = returnsRepository;
        this.withTransaction = withTransaction;
    }

    async execute(id, { status, note, inspected = false }, admin) {
        try {
            if (status === 'refunded') {
                throw new AppError(
                    'Record a refund through the refund action instead of setting the status directly',
                    422,
                    'RETURN_REFUND_VIA_ENDPOINT'
                );
            }

            if (status === 'rejected' && !note) {
                throw new AppError('A reason is required when rejecting a return', 422, 'RETURN_REJECT_REASON_REQUIRED');
            }

            const wantsInspection = inspected === true;

            const outcome = await this.withTransaction(async (client) => {
                const current = await this.returnsRepository.findForUpdateTx(client, id);

                if (!current) return { missing: true, restored: [] };

                // Terminal returns (`refunded`, `closed`) admit no further
                // movement: no receipt, no inspection confirmation and no
                // stock restoration. `rejected` stays reopenable through the
                // allowlist, but is still barred from receipt/inspection/
                // refund by the transition allowlist and the inspection gate.
                if (RETURN_TERMINAL_STATUSES.includes(current.status)) {
                    throw new AppError(
                        `This return is "${current.status}" and can no longer be changed`,
                        422,
                        'RETURN_TERMINAL'
                    );
                }

                // Inspection confirmation is only lawful once the goods are in
                // house, and only once per return.
                if (wantsInspection) {
                    const eligibleForInspection = ['pickup_pending', 'received', 'refund_pending'].includes(current.status);

                    if (!eligibleForInspection) {
                        throw new AppError(
                            'Inspection can only be confirmed for returns that have been received',
                            422,
                            'RETURN_INSPECTION_INELIGIBLE'
                        );
                    }

                    if (current.inspected_at) {
                        throw new AppError(
                            'This return has already been inspected',
                            422,
                            'RETURN_ALREADY_INSPECTED'
                        );
                    }
                }

                const isTransition = isAllowedReturnTransition(current.status, status);
                const isConfirmOnly = status === current.status;

                // A real move must be allowlisted; a same-status call is valid
                // only as an inspection confirmation on an already-received
                // return. Anything else is rejected.
                if (!isTransition && !(isConfirmOnly && wantsInspection)) {
                    throw new AppError(
                        `Cannot move a return from "${current.status}" to "${status}"`,
                        422,
                        'RETURN_TRANSITION_INVALID'
                    );
                }

                if (isTransition) {
                    const transitioned = await this.returnsRepository.transitionStatusTx(
                        client, id, current.status, status, admin, note
                    );

                    if (!transitioned) {
                        throw new AppError('The return was updated by someone else. Please reload and try again.', 409, 'RETURN_CONFLICT');
                    }
                }

                let lines = [];
                if (wantsInspection) {
                    // Persist the confirmation first, then restore — both in
                    // this transaction, so a failure rolls back both. A null
                    // confirmation means a duplicate slipped through the lock.
                    const confirmed = await this.returnsRepository.confirmInspectionTx(client, id);

                    if (!confirmed) {
                        throw new AppError('This return has already been inspected', 422, 'RETURN_ALREADY_INSPECTED');
                    }

                    lines = await this.returnsRepository.restoreStockTx(client, id);
                }

                return { missing: false, restored: lines };
            });

            if (outcome.missing) return null;

            const detail = toReturnDetail(await this.returnsRepository.findByIdAdmin(id));
            return { ...detail, stockRestored: outcome.restored };
        } catch (error) {
            logger.error('[UPDATE_RETURN_STATUS_ERROR]', { returnId: id, errorMessage: error.message });
            throw error;
        }
    }
}

export default UpdateReturnStatusUseCase;
