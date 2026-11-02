import type { Router } from 'express';

import { CreateLocationUseCase } from '../application/create-location.js';
import { GetLocationUseCase } from '../application/get-location.js';
import { ListLocationsUseCase } from '../application/list-locations.js';
import { UpdateLocationUseCase } from '../application/update-location.js';
import type { LocationRepository } from '../domain/location-repository.js';
import { createLocationsRouter } from './locations-router.js';

/** Composes the locations use cases over a repository and returns their HTTP router. */
export function createLocationsModule(repository: LocationRepository): Router {
  return createLocationsRouter({
    listLocations: new ListLocationsUseCase(repository),
    getLocation: new GetLocationUseCase(repository),
    createLocation: new CreateLocationUseCase(repository),
    updateLocation: new UpdateLocationUseCase(repository),
  });
}
