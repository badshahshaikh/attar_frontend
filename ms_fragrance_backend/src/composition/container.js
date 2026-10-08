
import * as database from '../infrastructure/database/postgres-database.js';
import * as storage from '../infrastructure/storage/supabase-storage.adapter.js';

import { createProductsContainer } from '../modules/products/products.container.js';
import { createCatalogContainer } from '../modules/catalog/catalog.container.js';
import { createUserRepository } from '../modules/auth/user.repository.js';
import { createAuthService } from '../modules/auth/auth.service.js';
import { createAuthController } from '../modules/auth/auth.controller.js';
import { createAuthRouter } from '../modules/auth/auth.routes.js';
import { createSettingsContainer } from '../modules/settings/settings.container.js';
import { createCustomerContainer } from '../modules/customer/customer.container.js';
import { createUsersContainer } from '../modules/users/users.container.js';

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

    const userRepository = createUserRepository({ query });
    const authService = createAuthService({ userRepository });
    const authController = createAuthController({ authService });

    // Settings module
    const settingsContainer = createSettingsContainer({ query });

    // Customer accounts module (addresses + orders)
    const customerContainer = createCustomerContainer({ query });

    // Registered users (customers) admin module — reuses the auth user repository
    const usersContainer = createUsersContainer({ userRepository });

    return Object.freeze({
        productRouter: productsContainer.productRouter,
        catalogRouter: catalogContainer.catalogRouter,
        authRouter: createAuthRouter(authController),
        settingsRouter: settingsContainer.settingsRouter,
        customerRouter: customerContainer.customerRouter,
        usersRouter: usersContainer.usersRouter,
    });
}

export { createContainer };