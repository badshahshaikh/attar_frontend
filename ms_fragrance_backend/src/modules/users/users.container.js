import { createUsersRouter } from './users.routes.js';
import { createUsersController } from './users.controller.js';
import GetCustomersUseCase from './application/use-cases/GetCustomersUseCase.js';

/**
 * UsersContainer - Dependency injection container for the registered users
 * (customers) admin module.
 *
 * Reuses the existing auth user repository (same `users` table) instead of
 * creating a new repository or table.
 *
 * Dependency flow:
 * UserRepository (existing)
 *   ↓
 * GetCustomersUseCase
 *   ↓
 * UsersController
 *   ↓
 * UsersRouter
 */
function createUsersContainer(dependencies = {}) {
    const userRepository = dependencies.userRepository;

    // Application layer (use cases)
    const getCustomersUseCase = new GetCustomersUseCase(userRepository);

    // Presentation layer
    const usersController = createUsersController({ getCustomersUseCase });

    const usersRouter = createUsersRouter(usersController);

    return Object.freeze({
        usersRouter,
        getCustomersUseCase
    });
}

export { createUsersContainer };