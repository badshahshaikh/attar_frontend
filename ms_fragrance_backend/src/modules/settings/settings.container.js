import { createSettingsRepository } from './settings.repository.js';
import GetFooterSettingsUseCase from './application/use-cases/GetFooterSettingsUseCase.js';
import UpdateFooterSettingsUseCase from './application/use-cases/UpdateFooterSettingsUseCase.js';
import { createSettingsController } from './settings.controller.js';
import { createSettingsRouter } from './settings.routes.js';

/**
 * SettingsContainer - Dependency injection container for settings module
 * 
 * Creates and wires up all dependencies for the settings module.
 * This makes the module testable and maintains clean separation of concerns.
 * 
 * Dependency flow:
 * Database
 *   ↓
 * SettingsRepository
 *   ↓
 * GetFooterSettingsUseCase / UpdateFooterSettingsUseCase
 *   ↓
 * SettingsController
 *   ↓
 * SettingsRouter
 */

import databaseModule from '../../infrastructure/database/postgres-database.js';

function createSettingsContainer(dependencies = {}) {
    const database = dependencies.database || databaseModule;

    // Repository layer
    const settingsRepository = createSettingsRepository({
        query: dependencies.query || database.query
    });

    // Application layer (use cases)
    const getFooterSettingsUseCase = new GetFooterSettingsUseCase(settingsRepository);
    const updateFooterSettingsUseCase = new UpdateFooterSettingsUseCase(settingsRepository);

    // Presentation layer
    const settingsController = createSettingsController({
        getFooterSettingsUseCase,
        updateFooterSettingsUseCase
    });

    const settingsRouter = createSettingsRouter(settingsController);

    return Object.freeze({
        settingsRouter,
        settingsRepository,
        getFooterSettingsUseCase,
        updateFooterSettingsUseCase
    });
}

export { createSettingsContainer };
