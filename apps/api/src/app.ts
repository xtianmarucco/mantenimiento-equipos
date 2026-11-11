import express, { type Express } from 'express';

import type { EquipmentRepository } from './modules/equipment/domain/equipment-repository.js';
import { createEquipmentModule } from './modules/equipment/infrastructure/create-equipment-module.js';
import { GetHealth } from './modules/health/application/get-health.js';
import { createHealthRouter } from './modules/health/infrastructure/health-router.js';
import type { LocationRepository } from './modules/locations/domain/location-repository.js';
import { createLocationsModule } from './modules/locations/infrastructure/create-locations-module.js';
import { errorHandler, notFoundHandler } from './shared/infrastructure/http-errors.js';

/** Adapters the app depends on. Production passes Prisma-backed ones; tests pass in-memory ones. */
export interface AppDependencies {
  locationRepository: LocationRepository;
  equipmentRepository: EquipmentRepository;
}

/** Builds the Express app without listening, so tests can drive it directly. */
export function createApp(dependencies: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.use('/api/health', createHealthRouter(new GetHealth()));
  app.use('/api/locations', createLocationsModule(dependencies.locationRepository));
  app.use(
    '/api/equipment',
    createEquipmentModule(dependencies.equipmentRepository, dependencies.locationRepository),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
