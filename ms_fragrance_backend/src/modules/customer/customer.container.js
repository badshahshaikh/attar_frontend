import { createCustomerAddressRepository } from './customer-address.repository.js';
import { createCustomerOrderRepository } from './customer-order.repository.js';
import { createCustomerService } from './customer.service.js';
import { createCustomerController } from './customer.controller.js';
import { createCustomerRouter } from './customer.routes.js';

import databaseModule from '../../infrastructure/database/postgres-database.js';
import { config as envConfig } from '../../config/env.js';

/**
 * CustomerContainer - Dependency injection container for the customer module
 *
 * Saved addresses, order history and order placement. Payment still happens
 * over WhatsApp, so orders are recorded with a `source` rather than charged.
 *
 * Dependency flow:
 * Database
 *   ↓
 * Address + Order repositories
 *   ↓
 * CustomerService (prices every line from the products table)
 *   ↓
 * CustomerController
 *   ↓
 * CustomerRouter
 */

function createCustomerContainer(dependencies = {}) {
    const database = dependencies.database || databaseModule;
    const query = dependencies.query || database.query;
    const withTransaction = dependencies.withTransaction || database.withTransaction;
    const config = dependencies.config || envConfig;

    const addressRepository = createCustomerAddressRepository({ query, withTransaction });
    const orderRepository = createCustomerOrderRepository({ query, withTransaction });

    const customerService = createCustomerService({
        addressRepository,
        orderRepository,
        razorpayKeyId: config.razorpay.keyId,
        razorpayKeySecret: config.razorpay.keySecret,
    });
    const customerController = createCustomerController({ customerService });
    const customerRouter = createCustomerRouter(customerController);

    return Object.freeze({
        customerRouter,
        addressRepository,
        orderRepository,
        customerService,
    });
}

export { createCustomerContainer };