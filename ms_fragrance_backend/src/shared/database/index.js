import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Add this function below the pool
export async function checkDatabaseConnection() {
    try {
        const result = await pool.query('SELECT NOW()');

        console.log(
            '[DB_DIAGNOSTIC] Connection successful:',
            result.rows[0]
        );

        return {
            connected: true,
            time: result.rows[0].now,
        };
    } catch (error) {
        console.error('[DB_DIAGNOSTIC] Connection failed:', {
            message: error.message,
            code: error.code,
            stack: error.stack,
        });

        throw error;
    }
}