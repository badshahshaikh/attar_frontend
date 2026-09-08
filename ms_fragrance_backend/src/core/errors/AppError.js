/**
 * AppError - Base error class for application errors
 * 
 * Provides consistent error structure with:
 * - message
 * - statusCode (HTTP status code)
 * - code (error code for programmatic handling)
 * - isOperational (distinguishes operational vs programming errors)
 */

class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
