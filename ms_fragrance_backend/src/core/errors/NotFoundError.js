
import AppError from './AppError.js';
/**
 * NotFoundError - Error for resource not found
 * 
 * Used when a requested resource (product, etc.) does not exist.
 * HTTP status: 404 Not Found
 */

class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, 'NOT_FOUND');
    }
}

export default NotFoundError;