
import { createCatalogRepository } from './catalog.repository.js';
const GetBrandsUseCase = require('./application/use-cases/GetBrandsUseCase.js');
const GetCategoriesUseCase = require('./application/use-cases/GetCategoriesUseCase.js');
const CreateBrandUseCase = require('./application/use-cases/CreateBrandUseCase');
const UpdateBrandUseCase = require('./application/use-cases/UpdateBrandUseCase');
const DeleteBrandUseCase = require('./application/use-cases/DeleteBrandUseCase');

const CreateCategoryUseCase = require('./application/use-cases/CreateCategoryUseCase');
const UpdateCategoryUseCase = require('./application/use-cases/UpdateCategoryUseCase');
const DeleteCategoryUseCase = require('./application/use-cases/DeleteCategoryUseCase');
const { createCatalogController } = require('./catalog.controller');
const { createCatalogRouter } = require('./catalog.routes');

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

function createCatalogContainer(dependencies = {}) {
    const database = dependencies.database || require('../../infrastructure/database/postgres-database');

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
