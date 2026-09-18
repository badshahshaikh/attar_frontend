import { createProductRepository } from './product.repository.js';

const GetProductsUseCase = require('./application/use-cases/GetProductsUseCase');
const GetProductByIdUseCase = require('./application/use-cases/GetProductByIdUseCase');
const CreateProductUseCase = require('./application/use-cases/CreateProductUseCase');
const UpdateProductUseCase = require('./application/use-cases/UpdateProductUseCase');
const DeleteProductUseCase = require('./application/use-cases/DeleteProductUseCase');
const BulkUpsertProductsUseCase = require('./application/use-cases/BulkUpsertProductsUseCase');
const UploadProductImageUseCase = require('./application/use-cases/UploadProductImageUseCase');
const { createProductController } = require('./product.controller');
const { createProductRouter } = require('./product.routes');

/**
 * ProductsContainer - Dependency injection container for products module
 * 
 * Creates and wires up all dependencies for the products module.
 * This makes the module testable and maintains clean separation of concerns.
 * 
 * Dependency flow:
 * Database
 *   ↓
 * ProductRepository
 *   ↓
 * Use Cases (GetProducts, GetProductById, Create, Update, Delete, BulkUpsert, UploadImage)
 *   ↓
 * ProductController
 *   ↓
 * ProductRouter
 */

function createProductsContainer(dependencies = {}) {
    const database = dependencies.database || require('../../infrastructure/database/postgres-database');
    const storage = dependencies.storage || require('../../infrastructure/storage/supabase-storage.adapter');

    // Repository layer
    const productRepository = createProductRepository({
        query: dependencies.query || database.query
    });

    // Application layer (use cases)
    const getProductsUseCase = new GetProductsUseCase(productRepository);
    const getProductByIdUseCase = new GetProductByIdUseCase(productRepository);
    const createProductUseCase = new CreateProductUseCase(productRepository);
    const updateProductUseCase = new UpdateProductUseCase(productRepository, storage);
    const deleteProductUseCase = new DeleteProductUseCase(productRepository, storage);
    const bulkUpsertProductsUseCase = new BulkUpsertProductsUseCase(productRepository);
    const uploadProductImageUseCase = new UploadProductImageUseCase(storage);

    // Get catalog use cases from dependencies (injected from main container)
    const getBrandsUseCase = dependencies.getBrandsUseCase;
    const getCategoriesUseCase = dependencies.getCategoriesUseCase;

    // Presentation layer
    const productController = createProductController({
        getProductsUseCase,
        getProductByIdUseCase,
        createProductUseCase,
        updateProductUseCase,
        deleteProductUseCase,
        bulkUpsertProductsUseCase,
        uploadProductImageUseCase,
        getBrandsUseCase,
        getCategoriesUseCase
    });

    const productRouter = createProductRouter(productController);

    return Object.freeze({
        productRouter,
        productRepository,
        getProductsUseCase,
        getProductByIdUseCase,
        createProductUseCase,
        updateProductUseCase,
        deleteProductUseCase,
        bulkUpsertProductsUseCase,
        uploadProductImageUseCase
    });
}

export { createProductsContainer };
