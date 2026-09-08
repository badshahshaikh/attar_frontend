const { createSettingsRepository } = require('./settings.repository');
const GetFooterSettingsUseCase = require('./application/use-cases/GetFooterSettingsUseCase');
const UpdateFooterSettingsUseCase = require('./application/use-cases/UpdateFooterSettingsUseCase');
const { createSettingsController } = require('./settings.controller');
const { createSettingsRouter } = require('./settings.routes');

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

function createSettingsContainer(dependencies = {}) {
    const database = dependencies.database || require('../../infrastructure/database/postgres-database');
    
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

module.exports = { createSettingsContainer };
