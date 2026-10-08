import express from 'express';
import cors from 'cors';
import path from 'node:path';
import cookieParser from 'cookie-parser';

import { config } from './config/env.js';
import { corsOptions } from './config/cors.js';
import { errorHandler } from './shared/errors/error-handler.js';
import { createContainer } from './composition/container.js';
import { createCustomerContainer } from './modules/customer/customer.container.js';
import { createPaymentWebhookRouter } from './modules/customer/payment-webhook.router.js';
import { checkDatabaseConnection } from './shared/database/index.js';

const app = express();
const { productRouter, catalogRouter, authRouter, settingsRouter, customerRouter, usersRouter } = createContainer();
const uploadDir = config.uploads.directory;

// Webhook router needs the raw body before express.json() strips it.
const customerContainer = createCustomerContainer();
const paymentWebhook = createPaymentWebhookRouter(customerContainer.customerService, config.razorpay.webhookSecret);

app.use(cors(corsOptions));
app.use(cookieParser());

// Raw-body webhook route (must come before express.json).
app.use('/api/webhooks', paymentWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(uploadDir));

app.use('/api/products', productRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/auth', authRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/customer', customerRouter);
app.use('/api/users', usersRouter);

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

export default app;
