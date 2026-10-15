import { createProductRepository } from './product.repository.js';
import { createProductRouter } from './product.routes.js';
import { createProductController } from './product.controller.js';

import GetProductsUseCase from './application/use-cases/GetProductsUseCase.js';
import GetProductByIdUseCase from './application/use-cases/GetProductByIdUseCase.js';
import CreateProductUseCase from './application/use-cases/CreateProductUseCase.js';
import UpdateProductUseCase from './application/use-cases/UpdateProductUseCase.js';
import DeleteProductUseCase from './application/use-cases/DeleteProductUseCase.js';
import DeleteProductsUseCase from './application/use-cases/DeleteProductsUseCase.js';
import BulkUpsertProductsUseCase from './application/use-cases/BulkUpsertProductsUseCase.js';
import UploadProductImageUseCase from './application/use-cases/UploadProductImageUseCase.js';
import AiFillProductUseCase from './application/use-cases/aiFillProductUseCase.js';
import AiGenerateProductImageUseCase from './application/use-cases/AiGenerateProductImageUseCase.js';
import ProductAiService from '../../shared/ai/product-ai.service.js';
import openai from '../../shared/ai/openai.client.js';





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

import databaseModule from '../../infrastructure/database/postgres-database.js';
import storageModule from '../../infrastructure/storage/supabase-storage.adapter.js';

function createProductsContainer(dependencies = {}) {
    const database = dependencies.database || databaseModule;
    const storage = dependencies.storage || storageModule;

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
    const deleteProductsUseCase = new DeleteProductsUseCase(productRepository, storage);
    const bulkUpsertProductsUseCase = new BulkUpsertProductsUseCase(productRepository);
    const uploadProductImageUseCase = new UploadProductImageUseCase(storage);

    // Get catalog use cases from dependencies (injected from main container)
    const getBrandsUseCase = dependencies.getBrandsUseCase;
    const getCategoriesUseCase = dependencies.getCategoriesUseCase;
    const productAiService =
        dependencies.productAiService ||
        new ProductAiService({
            client: openai
        });

    const aiFillProductUseCase =
        new AiFillProductUseCase(productAiService);

    const aiGenerateProductImageUseCase =
        new AiGenerateProductImageUseCase(productAiService);
    // Presentation layer
    const productController = createProductController({
        getProductsUseCase,
        getProductByIdUseCase,
        createProductUseCase,
        updateProductUseCase,
        deleteProductUseCase,
        deleteProductsUseCase,
        bulkUpsertProductsUseCase,
        uploadProductImageUseCase,
        getBrandsUseCase,
        getCategoriesUseCase,
        aiFillProductUseCase,
        aiGenerateProductImageUseCase
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
        deleteProductsUseCase,
        bulkUpsertProductsUseCase,
        uploadProductImageUseCase,
        aiFillProductUseCase,
        aiGenerateProductImageUseCase
    });
}

export { createProductsContainer };
