
import * as database from '../infrastructure/database/postgres-database.js';
import * as storage from '../infrastructure/storage/supabase-storage.adapter.js';

import { createProductsContainer } from '../modules/products/products.container.js';
import { createCatalogContainer } from '../modules/catalog/catalog.container.js';
import { createSeoContainer } from '../modules/seo/seo.container.js';
import { createUserRepository } from '../modules/auth/user.repository.js';
import { createAuthService } from '../modules/auth/auth.service.js';
import { createAuthController } from '../modules/auth/auth.controller.js';
import { createAuthRouter } from '../modules/auth/auth.routes.js';
import { createSettingsContainer } from '../modules/settings/settings.container.js';
import { createCustomerContainer } from '../modules/customer/customer.container.js';
import { createUsersContainer } from '../modules/users/users.container.js';
import { createOrdersContainer } from '../modules/orders/orders.container.js';
import { createReturnsContainer } from '../modules/returns/returns.container.js';

function createContainer(dependencies = {}) {
    const query = dependencies.query || database.query;

    // Catalog module for brands and categories
    const catalogContainer = createCatalogContainer({ query });

    // Products module
    const productsContainer = createProductsContainer({
        query,
        storage: dependencies.storage || storage,
        getBrandsUseCase: catalogContainer.getBrandsUseCase,
        getCategoriesUseCase: catalogContainer.getCategoriesUseCase,
        productAiService: dependencies.productAiService
    });

    // Customer accounts module (addresses + orders)
    const customerContainer = createCustomerContainer({ query });

    const userRepository = createUserRepository({ query });
    const authService = createAuthService({
        userRepository,
        orderRepository: customerContainer.orderRepository,
    });
    const authController = createAuthController({ authService });

    // Settings module
    const settingsContainer = createSettingsContainer({ query });

    // SEO module
    const seoContainer = createSeoContainer({ query });

    // Registered users (customers) admin module — reuses the auth user repository
    const usersContainer = createUsersContainer({ userRepository });

    // Admin orders module — reuses the existing customer order repository
    const ordersContainer = createOrdersContainer({
        orderRepository: customerContainer.orderRepository
    });

    // Admin returns module — own tables, same query/transaction plumbing
    const returnsContainer = createReturnsContainer({ query });

    return Object.freeze({
        productRouter: productsContainer.productRouter,
        catalogRouter: catalogContainer.catalogRouter,
        authRouter: createAuthRouter(authController),
        settingsRouter: settingsContainer.settingsRouter,
        seoRouter: seoContainer.seoRouter,
        customerRouter: customerContainer.customerRouter,
        usersRouter: usersContainer.usersRouter,
        ordersRouter: ordersContainer.ordersRouter,
        returnsRouter: returnsContainer.returnsRouter,
    });
}

export { createContainer };