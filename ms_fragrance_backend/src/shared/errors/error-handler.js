const { logger } = require('../logging/logger');

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
    if (error instanceof Error && (error.code === 'LIMIT_FILE_SIZE' || error.message === 'Only image files are allowed')) {
        return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : error.message });
    }

    logger.error('[UNHANDLED_ERROR]', {
        method: req.method,
        path: req.originalUrl,
        errorCode: error.code || null,
        errorMessage: error.message,
    });
    return res.status(500).json({ error: 'Internal server error' });
}

module.exports = { errorHandler };
