import { createControllerApp } from './app.js';

// Configuration
export * from './config/env.js';

// Middleware
export * from './middleware/unifiedAuthMiddleware.js';
export * from './middleware/securityMiddleware.js';
export * from './middleware/errorHandler.js';

// Inter-Component Coordinators
export * from './coordinators/deviceEventCoordinator.js';
export * from './coordinators/userAccountCoordinator.js';
export * from './coordinators/storageEventCoordinator.js';

// App Factory
export { createControllerApp };
export default createControllerApp;
