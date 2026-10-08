import { createOrdersRouter } from './orders.routes.js';
import { createOrdersController } from './orders.controller.js';
import GetOrdersUseCase from './application/use-cases/GetOrdersUseCase.js';
import GetOrderByIdUseCase from './application/use-cases/GetOrderByIdUseCase.js';

/**
 * OrdersContainer - Dependency injection container for the admin orders module
 *
 * Reuses the existing customer order repository (same `orders` and
 * `order_items` tables) instead of creating a new repository or table.
 *
 * Dependency flow:
 * OrderRepository (existing, customer module)
 *   ↓
 * GetOrdersUseCase + GetOrderByIdUseCase
 *   ↓
 * OrdersController
 *   ↓
 * OrdersRouter
 */
function createOrdersContainer(dependencies = {}) {
    const orderRepository = dependencies.orderRepository;

    // Application layer (use cases)
    const getOrdersUseCase = new GetOrdersUseCase(orderRepository);
    const getOrderByIdUseCase = new GetOrderByIdUseCase(orderRepository);

    // Presentation layer
    const ordersController = createOrdersController({ getOrdersUseCase, getOrderByIdUseCase });

    const ordersRouter = createOrdersRouter(ordersController);

    return Object.freeze({
        ordersRouter,
        getOrdersUseCase,
        getOrderByIdUseCase
    });
}

export { createOrdersContainer };