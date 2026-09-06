const { config, normalizeOrigin } = require('./env');
const { logger } = require('../shared/logging/logger');

const corsOptions = {
    origin: (origin, callback) => {
        const normalizedOrigin = normalizeOrigin(origin);
        if (!origin) return callback(null, true);
        if (config.cors.allowedOrigins.includes(normalizedOrigin)) return callback(null, normalizedOrigin);
        logger.warn('[CORS_REJECTED]', {
            environment: config.environment,
            receivedOrigin: origin,
            normalizedOrigin,
            allowedOrigins: config.cors.allowedOrigins,
        });
        return callback(new Error('Origin is not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
};

module.exports = { corsOptions };
