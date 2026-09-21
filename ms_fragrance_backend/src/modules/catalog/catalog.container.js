
import { createCatalogRepository } from './catalog.repository.js';
import GetBrandsUseCase from './application/use-cases/GetBrandsUseCase.js';
import GetCategoriesUseCase from './application/use-cases/GetCategoriesUseCase.js';
import CreateBrandUseCase from './application/use-cases/CreateBrandUseCase.js';
import UpdateBrandUseCase from './application/use-cases/UpdateBrandUseCase.js';
import DeleteBrandUseCase from './application/use-cases/DeleteBrandUseCase.js';

import CreateCategoryUseCase from './application/use-cases/CreateCategoryUseCase.js';
import UpdateCategoryUseCase from './application/use-cases/UpdateCategoryUseCase.js';
import DeleteCategoryUseCase from './application/use-cases/DeleteCategoryUseCase.js';
import { createCatalogController } from './catalog.controller.js';
import { createCatalogRouter } from './catalog.routes.js';

/**
 * CatalogContainer - Dependency injection container for catalog module
 * 
 * Manages brands and categories with proper dependency injection.
 * 
 * Dependency flow:
 * Database
 *   ↓
 * CatalogRepository
 *   ↓
 * Use Cases (Brands + Categories)
 *   ↓
 * CatalogController
 *   ↓
 * CatalogRouter
 */

import databaseModule from '../../infrastructure/database/postgres-database.js';

function createCatalogContainer(dependencies = {}) {
    const database = dependencies.database || databaseModule;

    // Repository layer
    const catalogRepository = createCatalogRepository({
        query: dependencies.query || database.query
    });

    // Application layer (use cases)
    const getBrandsUseCase = new GetBrandsUseCase(catalogRepository);
    const createBrandUseCase = new CreateBrandUseCase(catalogRepository);
    const updateBrandUseCase = new UpdateBrandUseCase(catalogRepository);
    const deleteBrandUseCase = new DeleteBrandUseCase(catalogRepository);

    const getCategoriesUseCase = new GetCategoriesUseCase(catalogRepository);
    const createCategoryUseCase = new CreateCategoryUseCase(catalogRepository);
    const updateCategoryUseCase = new UpdateCategoryUseCase(catalogRepository);
    const deleteCategoryUseCase = new DeleteCategoryUseCase(catalogRepository);

    // Presentation layer
    const catalogController = createCatalogController({
        getBrandsUseCase,
        createBrandUseCase,
        updateBrandUseCase,
        deleteBrandUseCase,
        getCategoriesUseCase,
        createCategoryUseCase,
        updateCategoryUseCase,
        deleteCategoryUseCase
    });

    const catalogRouter = createCatalogRouter(catalogController);

    return Object.freeze({
        catalogRouter,
        catalogRepository,
        getBrandsUseCase,
        getCategoriesUseCase
    });
}

export { createCatalogContainer };
