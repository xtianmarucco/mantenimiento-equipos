import {
  locationResponseSchema,
  type CreateLocationInput,
  type LocationResponse,
  type UpdateLocationInput,
} from '@mantenimiento/shared';
import { z } from 'zod';

import { getJson, sendJson } from './client';

const locationListSchema = z.array(locationResponseSchema);

/** Lists every location, sorted by name by the API. */
export function listLocations(options: { signal?: AbortSignal } = {}): Promise<LocationResponse[]> {
  return getJson('/api/locations', locationListSchema, options);
}

function locationPath(id: string): string {
  return `/api/locations/${encodeURIComponent(id)}`;
}

/** Gets one location; a missing id rejects with an `ApiError` with status 404. */
export function getLocation(
  id: string,
  options: { signal?: AbortSignal } = {},
): Promise<LocationResponse> {
  return getJson(locationPath(id), locationResponseSchema, options);
}

/** Creates a location; invalid input rejects with status 400. */
export function createLocation(input: CreateLocationInput): Promise<LocationResponse> {
  return sendJson('POST', '/api/locations', locationResponseSchema, { body: input });
}

/** Updates only the given fields; `null` clears an optional field. */
export function updateLocation(
  id: string,
  changes: UpdateLocationInput,
): Promise<LocationResponse> {
  return sendJson('PATCH', locationPath(id), locationResponseSchema, { body: changes });
}
