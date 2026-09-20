
import * as database from '../infrastructure/database/postgres-database.js';
import * as storage from '../infrastructure/storage/supabase-storage.adapter.js';

import { createProductsContainer } from '../modules/products/products.container.js';
import { createCatalogContainer } from '../modules/catalog/catalog.container.js';
import { createUserRepository } from '../modules/auth/user.repository.js';
import { createAuthService } from '../modules/auth/auth.service.js';
import { createAuthController } from '../modules/auth/auth.controller.js';
import { createAuthRouter } from '../modules/auth/auth.routes.js';
import { createSettingsContainer } from '../modules/settings/settings.container.js';

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
    });

    const userRepository = createUserRepository({ query });
    const authService = createAuthService({ userRepository });
    const authController = createAuthController({ authService });

    // Settings module
    const settingsContainer = createSettingsContainer({ query });

    return Object.freeze({
        productRouter: productsContainer.productRouter,
        catalogRouter: catalogContainer.catalogRouter,
        authRouter: createAuthRouter(authController),
        settingsRouter: settingsContainer.settingsRouter,
    });
}

export { createContainer };