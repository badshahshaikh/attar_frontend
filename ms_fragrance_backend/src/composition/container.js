const database = require('../infrastructure/database/postgres-database');
const storage = require('../infrastructure/storage/supabase-storage.adapter');
const { createProductRepository } = require('../modules/products/product.repository');
const { createProductService } = require('../modules/products/product.service');
const { createProductController } = require('../modules/products/product.controller');
const { createProductRouter } = require('../modules/products/product.routes');
const { createUserRepository } = require('../modules/auth/user.repository');
const { createAuthService } = require('../modules/auth/auth.service');
const { createAuthController } = require('../modules/auth/auth.controller');
const { createAuthRouter } = require('../modules/auth/auth.routes');

function createContainer(dependencies = {}) {
    const productRepository = createProductRepository({ query: dependencies.query || database.query });
    const productService = createProductService({ productRepository, storage: dependencies.storage || storage });
    const productController = createProductController({ productService });
    const userRepository = createUserRepository({ query: dependencies.query || database.query });
    const authService = createAuthService({ userRepository });
    const authController = createAuthController({ authService });
    return Object.freeze({ productRouter: createProductRouter(productController), authRouter: createAuthRouter(authController) });
}

module.exports = { createContainer };
