require('dotenv').config();
const bcrypt = require('bcrypt');
const { query, closeDb, initializeDatabase } = require('./src/db');

async function createAdmin() {
    try {
        const username = process.env.ADMIN_USERNAME;
        const email = process.env.ADMIN_EMAIL;
        const password = process.env.ADMIN_PASSWORD;

        if (!username || !email || !password) {
            console.error('Error: ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD environment variables are required.');
            process.exit(1);
        }

        await initializeDatabase();

        const existingUser = await query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
        
        if (existingUser.rows.length > 0) {
            console.error('Error: A user with this username or email already exists.');
            process.exit(1);
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const result = await query(
            'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
            [username, email, passwordHash, 'admin']
        );

        console.log('Admin created successfully:');
        console.log(`username: ${result.rows[0].username}`);
        console.log(`email: ${result.rows[0].email}`);
    } catch (error) {
        console.error('Error creating admin:', error);
    } finally {
        await closeDb();
    }
}

createAdmin();
