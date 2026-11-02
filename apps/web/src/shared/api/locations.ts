import { locationResponseSchema, type LocationResponse } from '@mantenimiento/shared';
import { z } from 'zod';

import { getJson } from './client';

const locationListSchema = z.array(locationResponseSchema);

/** Lists every location, sorted by name by the API. */
export function listLocations(options: { signal?: AbortSignal } = {}): Promise<LocationResponse[]> {
  return getJson('/api/locations', locationListSchema, options);
}
