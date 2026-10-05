import { logger } from '../../shared/logging/logger.js';

const ADDRESS_COLUMNS = `id, label, full_name, phone, line1, line2, city, state,
    postal_code, country, is_default, created_at, updated_at`;

function createCustomerAddressRepository({ query, withTransaction }) {
    return {
        async list(userId) {
            try {
                const result = await query(
                    `SELECT ${ADDRESS_COLUMNS} FROM public.addresses
                     WHERE user_id = $1
                     ORDER BY is_default DESC, created_at DESC`,
                    [userId]
                );
                return result.rows;
            } catch (error) {
                logger.error('[CUSTOMER_ADDRESS_LIST_ERROR]', { userId, errorMessage: error.message });
                throw error;
            }
        },

        async findById(userId, id) {
            const result = await query(
                `SELECT ${ADDRESS_COLUMNS} FROM public.addresses WHERE user_id = $1 AND id = $2`,
                [userId, id]
            );
            return result.rows[0] || null;
        },

        async count(userId) {
            const result = await query(
                'SELECT COUNT(*)::int AS total FROM public.addresses WHERE user_id = $1',
                [userId]
            );
            return result.rows[0].total;
        },

        // Clearing and re-setting the default happens in one transaction so the
        // partial unique index can never be violated halfway through.
        async create(userId, payload) {
            try {
                return await withTransaction(async (client) => {
                    const total = await client.query(
                        'SELECT COUNT(*)::int AS total FROM public.addresses WHERE user_id = $1',
                        [userId]
                    );
                    // The first address a customer saves becomes their default.
                    const makeDefault = payload.isDefault || total.rows[0].total === 0;

                    if (makeDefault) {
                        await client.query(
                            'UPDATE public.addresses SET is_default = FALSE WHERE user_id = $1',
                            [userId]
                        );
                    }

                    const inserted = await client.query(
                        `INSERT INTO public.addresses
                            (user_id, label, full_name, phone, line1, line2, city, state, postal_code, country, is_default)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                         RETURNING ${ADDRESS_COLUMNS}`,
                        [
                            userId, payload.label, payload.fullName, payload.phone, payload.line1,
                            payload.line2, payload.city, payload.state, payload.postalCode,
                            payload.country, makeDefault,
                        ]
                    );

                    return inserted.rows[0];
                });
            } catch (error) {
                logger.error('[CUSTOMER_ADDRESS_CREATE_ERROR]', { userId, errorMessage: error.message });
                throw error;
            }
        },

        async update(userId, id, payload) {
            try {
                return await withTransaction(async (client) => {
                    if (payload.isDefault) {
                        await client.query(
                            'UPDATE public.addresses SET is_default = FALSE WHERE user_id = $1',
                            [userId]
                        );
                    }

                    const updated = await client.query(
                        `UPDATE public.addresses
                         SET label = $1, full_name = $2, phone = $3, line1 = $4, line2 = $5,
                             city = $6, state = $7, postal_code = $8, country = $9, is_default = $10,
                             updated_at = NOW()
                         WHERE user_id = $11 AND id = $12
                         RETURNING ${ADDRESS_COLUMNS}`,
                        [
                            payload.label, payload.fullName, payload.phone, payload.line1,
                            payload.line2, payload.city, payload.state, payload.postalCode,
                            payload.country, payload.isDefault, userId, id,
                        ]
                    );

                    return updated.rows[0] || null;
                });
            } catch (error) {
                logger.error('[CUSTOMER_ADDRESS_UPDATE_ERROR]', { userId, addressId: id, errorMessage: error.message });
                throw error;
            }
        },

        async setDefault(userId, id) {
            try {
                // The partial unique index allows only one default per user, so the
                // existing default must be cleared first within one transaction.
                return await withTransaction(async (client) => {
                    const target = await client.query(
                        'SELECT id FROM public.addresses WHERE user_id = $1 AND id = $2',
                        [userId, id]
                    );

                    if (!target.rows[0]) return null;

                    await client.query(
                        'UPDATE public.addresses SET is_default = FALSE WHERE user_id = $1',
                        [userId]
                    );

                    const updated = await client.query(
                        `UPDATE public.addresses SET is_default = TRUE, updated_at = NOW()
                         WHERE user_id = $1 AND id = $2 RETURNING id`,
                        [userId, id]
                    );

                    return updated.rows[0] || null;
                });
            } catch (error) {
                logger.error('[CUSTOMER_ADDRESS_SET_DEFAULT_ERROR]', {
                    userId,
                    addressId: id,
                    errorMessage: error.message,
                });
                throw error;
            }
        },

        // Deleting the default promotes the most recent remaining address.
        async remove(userId, id) {
            try {
                return await withTransaction(async (client) => {
                    const removed = await client.query(
                        'DELETE FROM public.addresses WHERE user_id = $1 AND id = $2 RETURNING id, is_default',
                        [userId, id]
                    );

                    if (!removed.rows[0]) return null;

                    if (removed.rows[0].is_default) {
                        await client.query(
                            `UPDATE public.addresses SET is_default = TRUE
                             WHERE id = (
                                 SELECT id FROM public.addresses
                                 WHERE user_id = $1
                                 ORDER BY created_at DESC
                                 LIMIT 1
                             )`,
                            [userId]
                        );
                    }

                    return removed.rows[0];
                });
            } catch (error) {
                logger.error('[CUSTOMER_ADDRESS_DELETE_ERROR]', { userId, addressId: id, errorMessage: error.message });
                throw error;
            }
        },
    };
}

export { createCustomerAddressRepository };