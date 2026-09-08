const AppError = require('./AppError');

/**
 * ValidationError - Error for input validation failures
 * 
 * Used when request data fails validation rules.
 * HTTP status: 400 Bad Request
 */

class ValidationError extends AppError {
    constructor(message, details = null) {
        super(message, 400, 'VALIDATION_ERROR');
        this.details = details;
    }
}

module.exports = ValidationError;
