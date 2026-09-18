const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const { config } = require('./config/env');
const { corsOptions } = require('./config/cors');
const { errorHandler } = require('./shared/errors/error-handler');
const { createContainer } = require('./composition/container');


const { checkDatabaseConnection } = require('./shared/database');

const app = express();
const { productRouter, catalogRouter, authRouter, settingsRouter } = createContainer();
const uploadDir = config.uploads.directory;

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(uploadDir));

app.use('/api/products', productRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/auth', authRouter);
app.use('/api/settings', settingsRouter);

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        environment: config.environment,
        database: 'postgresql',
        timestamp: new Date().toISOString(),
    });
});

app.get('/api/health/db', async (req, res) => {
    try {
        const result = await checkDatabaseConnection();
        res.json(result);
    } catch (error) {
        res.status(503).json({
            connected: false,
            error: error.message,
        });
    }
});

app.use(errorHandler);

module.exports = app;
