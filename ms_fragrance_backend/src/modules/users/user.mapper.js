/**
 * user.mapper.js — Maps users rows (selected with CUSTOMER_COLUMNS) to the
 * API customer shape.
 *
 * Only whitelisted columns are exposed. password_hash and any other
 * authentication material are never part of the select, so they can never
 * appear in a response.
 */
function toCustomer(row) {
    return {
        id: row.id,
        fullName: row.full_name || '',
        email: row.email || '',
        phone: row.phone || '',
        // There is no status column on `users`; last_login_at is the only
        // account state available, so fresh registrations are "new" until
        // the customer signs in at least once.
        status: row.last_login_at ? 'active' : 'new',
        registeredAt: row.created_at,
        lastLoginAt: row.last_login_at || null
    };
}

export { toCustomer };