import {
  createLocationSchema,
  idSchema,
  locationResponseSchema,
  updateLocationSchema,
  type LocationResponse,
} from '@mantenimiento/shared';
import { Router } from 'express';

import { parseRequest } from '../../../shared/infrastructure/request-validation.js';
import type { CreateLocation } from '../application/create-location.js';
import type { GetLocation } from '../application/get-location.js';
import type { ListLocations } from '../application/list-locations.js';
import type { UpdateLocation } from '../application/update-location.js';
import type { Location } from '../domain/location.js';

export interface LocationsUseCases {
  listLocations: ListLocations;
  getLocation: GetLocation;
  createLocation: CreateLocation;
  updateLocation: UpdateLocation;
}

const INVALID_ID = 'Invalid location id';
const INVALID_BODY = 'Invalid request body';

/** Maps the domain entity to the shared response contract, validating it so the API cannot drift. */
function toResponse(location: Location): LocationResponse {
  return locationResponseSchema.parse({
    ...location,
    createdAt: location.createdAt.toISOString(),
    updatedAt: location.updatedAt.toISOString(),
  });
}

/**
 * HTTP adapter for the locations module, mounted under `/api/locations`. There is no DELETE:
 * equipment references locations (`ON DELETE RESTRICT`).
 */
export function createLocationsRouter(useCases: LocationsUseCases): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const locations = await useCases.listLocations.execute();
    res.status(200).json(locations.map(toResponse));
  });

  router.get('/:id', async (req, res) => {
    const id = parseRequest(idSchema, req.params.id, INVALID_ID);
    const location = await useCases.getLocation.execute(id);
    res.status(200).json(toResponse(location));
  });

  router.post('/', async (req, res) => {
    const data = parseRequest(createLocationSchema, req.body, INVALID_BODY);
    const location = await useCases.createLocation.execute(data);
    res.status(201).json(toResponse(location));
  });

  router.patch('/:id', async (req, res) => {
    const id = parseRequest(idSchema, req.params.id, INVALID_ID);
    const changes = parseRequest(updateLocationSchema, req.body, INVALID_BODY);
    const location = await useCases.updateLocation.execute(id, changes);
    res.status(200).json(toResponse(location));
  });

  return router;
}
