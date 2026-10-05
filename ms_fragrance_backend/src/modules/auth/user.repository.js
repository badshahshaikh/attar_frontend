const CUSTOMER_COLUMNS = 'id, email, full_name, phone, role, created_at, last_login_at';

function createUserRepository({ query }) {
    return {
        async findByUsernameOrEmail(username) {
            const result = await query('SELECT * FROM users WHERE username = $1 OR email = $1', [username]);
            return result.rows[0] || null;
        },

        async findByEmail(email) {
            const result = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
            return result.rows[0] || null;
        },

        // role is hard-coded: it is never read from request input.
        async createCustomer({ fullName, email, passwordHash, phone }) {
            const result = await query(
                `INSERT INTO users (email, password_hash, role, full_name, phone)
                 VALUES ($1, $2, 'customer', $3, $4)
                 RETURNING ${CUSTOMER_COLUMNS}`,
                [email, passwordHash, fullName, phone]
            );
            return result.rows[0] || null;
        },

        async findCustomerById(id) {
            const result = await query(
                `SELECT ${CUSTOMER_COLUMNS} FROM users WHERE id = $1 AND role = 'customer'`,
                [id]
            );
            return result.rows[0] || null;
        },

        // Password material is fetched separately so it can never leak into a
        // profile response by accident.
        async findCustomerCredentialsById(id) {
            const result = await query(
                `SELECT id, email, password_hash FROM users WHERE id = $1 AND role = 'customer'`,
                [id]
            );
            return result.rows[0] || null;
        },

        async updateCustomerProfile(id, { fullName, phone }) {
            const result = await query(
                `UPDATE users
                 SET full_name = $1, phone = $2, updated_at = NOW()
                 WHERE id = $3 AND role = 'customer'
                 RETURNING ${CUSTOMER_COLUMNS}`,
                [fullName, phone, id]
            );
            return result.rows[0] || null;
        },

        async updatePasswordHash(id, passwordHash) {
            const result = await query(
                `UPDATE users SET password_hash = $1, updated_at = NOW()
                 WHERE id = $2 AND role = 'customer' RETURNING id`,
                [passwordHash, id]
            );
            return result.rows[0] || null;
        },

        async touchLastLogin(id) {
            await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [id]);
        },
    };
}

export { createUserRepository };