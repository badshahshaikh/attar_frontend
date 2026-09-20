function createUserRepository({ query }) {
    return {
        async findByUsernameOrEmail(username) {
            const result = await query('SELECT * FROM users WHERE username = $1 OR email = $1', [username]);
            return result.rows[0] || null;
        },
    };
}

export { createUserRepository };