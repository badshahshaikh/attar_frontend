
import { config, normalizeOrigin } from './env.js';
import { logger } from '../shared/logging/logger.js';

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

export { corsOptions };
