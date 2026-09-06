const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const { config } = require('./config/env');
const { corsOptions } = require('./config/cors');
const { errorHandler } = require('./shared/errors/error-handler');
const { createContainer } = require('./composition/container');

const app = express();
const { productRouter, authRouter } = createContainer();
const uploadDir = config.uploads.directory;

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, '../admin')));

app.use('/api/products', productRouter);
app.use('/api/auth', authRouter);

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        environment: config.environment,
        database: 'postgresql',
        timestamp: new Date().toISOString(),
    });
});

app.use(errorHandler);

module.exports = app;
