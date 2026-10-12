import { createReturnsRepository } from './returns.repository.js';
import { createReturnsController } from './returns.controller.js';
import { createReturnsRouter } from './returns.routes.js';
import GetReturnsUseCase from './application/use-cases/GetReturnsUseCase.js';
import GetReturnByIdUseCase from './application/use-cases/GetReturnByIdUseCase.js';
import GetReturnEligibilityUseCase from './application/use-cases/GetReturnEligibilityUseCase.js';
import CreateReturnUseCase from './application/use-cases/CreateReturnUseCase.js';
import UpdateReturnStatusUseCase from './application/use-cases/UpdateReturnStatusUseCase.js';
import RecordRefundUseCase from './application/use-cases/RecordRefundUseCase.js';

import databaseModule from '../../infrastructure/database/postgres-database.js';

/**
 * ReturnsContainer - Dependency injection container for the admin-managed
 * returns module. Mirrors the orders container: repository built on the
 * shared query/withTransaction plumbing, use cases on top, then controller
 * and router.
 */
function createReturnsContainer(dependencies = {}) {
    const database = dependencies.database || databaseModule;
    const query = dependencies.query || database.query;
    const withTransaction = dependencies.withTransaction || database.withTransaction;

    const returnsRepository = createReturnsRepository({ query, withTransaction });

    const getReturnsUseCase = new GetReturnsUseCase(returnsRepository);
    const getReturnByIdUseCase = new GetReturnByIdUseCase(returnsRepository);
    const getReturnEligibilityUseCase = new GetReturnEligibilityUseCase(returnsRepository);
    const createReturnUseCase = new CreateReturnUseCase(returnsRepository, withTransaction);
    const updateReturnStatusUseCase = new UpdateReturnStatusUseCase(returnsRepository, withTransaction);
    const recordRefundUseCase = new RecordRefundUseCase(returnsRepository, withTransaction);

    const returnsController = createReturnsController({
        getReturnsUseCase,
        getReturnByIdUseCase,
        getReturnEligibilityUseCase,
        createReturnUseCase,
        updateReturnStatusUseCase,
        recordRefundUseCase,
    });

    const returnsRouter = createReturnsRouter(returnsController);

    return Object.freeze({
        returnsRouter,
        returnsRepository,
        getReturnsUseCase,
        getReturnByIdUseCase,
        getReturnEligibilityUseCase,
        createReturnUseCase,
        updateReturnStatusUseCase,
        recordRefundUseCase,
    });
}

export { createReturnsContainer };
