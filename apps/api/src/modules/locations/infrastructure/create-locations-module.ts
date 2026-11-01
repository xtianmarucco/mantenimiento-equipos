import type { Router } from 'express';

import { CreateLocation } from '../application/create-location.js';
import { GetLocation } from '../application/get-location.js';
import { ListLocations } from '../application/list-locations.js';
import { UpdateLocation } from '../application/update-location.js';
import type { LocationRepository } from '../domain/location-repository.js';
import { createLocationsRouter } from './locations-router.js';

/** Composes the locations use cases over a repository and returns their HTTP router. */
export function createLocationsModule(repository: LocationRepository): Router {
  return createLocationsRouter({
    listLocations: new ListLocations(repository),
    getLocation: new GetLocation(repository),
    createLocation: new CreateLocation(repository),
    updateLocation: new UpdateLocation(repository),
  });
}
