const database = require('../infrastructure/database/postgres-database');
const storage = require('../infrastructure/storage/supabase-storage.adapter');
const { createProductsContainer } = require('../modules/products/products.container');
const { createUserRepository } = require('../modules/auth/user.repository');
const { createAuthService } = require('../modules/auth/auth.service');
const { createAuthController } = require('../modules/auth/auth.controller');
const { createAuthRouter } = require('../modules/auth/auth.routes');
const { createSettingsContainer } = require('../modules/settings/settings.container');

function createContainer(dependencies = {}) {
    // Products module now uses its own container with proper architecture
    const productsContainer = createProductsContainer({ 
        query: dependencies.query || database.query,
        storage: dependencies.storage || storage
    });

    const userRepository = createUserRepository({ query: dependencies.query || database.query });
    const authService = createAuthService({ userRepository });
    const authController = createAuthController({ authService });
    
    // Settings module now uses its own container with proper architecture
    const settingsContainer = createSettingsContainer({ 
        query: dependencies.query || database.query 
    });

    return Object.freeze({
        productRouter: productsContainer.productRouter,
        authRouter: createAuthRouter(authController),
        settingsRouter: settingsContainer.settingsRouter
    });
}

module.exports = { createContainer };
