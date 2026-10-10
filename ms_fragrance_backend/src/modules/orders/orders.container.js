import { createOrdersRouter } from './orders.routes.js';
import { createOrdersController } from './orders.controller.js';
import GetOrdersUseCase from './application/use-cases/GetOrdersUseCase.js';
import GetOrderByIdUseCase from './application/use-cases/GetOrderByIdUseCase.js';
import UpdateOrderStatusUseCase from './application/use-cases/UpdateOrderStatusUseCase.js';
import GenerateInvoiceUseCase from './application/use-cases/GenerateInvoiceUseCase.js';

/**
 * OrdersContainer - Dependency injection container for the admin orders module
 *
 * Reuses the existing customer order repository (same `orders` and
 * `order_items` tables) instead of creating a new repository or table.
 *
 * Dependency flow:
 * OrderRepository (existing, customer module)
 *   ↓
 * GetOrdersUseCase + GetOrderByIdUseCase + UpdateOrderStatusUseCase + GenerateInvoiceUseCase
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
    const updateOrderStatusUseCase = new UpdateOrderStatusUseCase(orderRepository);
    const generateInvoiceUseCase = new GenerateInvoiceUseCase(orderRepository);

    // Presentation layer
    const ordersController = createOrdersController({
        getOrdersUseCase,
        getOrderByIdUseCase,
        updateOrderStatusUseCase,
        generateInvoiceUseCase,
    });

    const ordersRouter = createOrdersRouter(ordersController);

    return Object.freeze({
        ordersRouter,
        getOrdersUseCase,
        getOrderByIdUseCase,
        updateOrderStatusUseCase,
        generateInvoiceUseCase
    });
}

export { createOrdersContainer };