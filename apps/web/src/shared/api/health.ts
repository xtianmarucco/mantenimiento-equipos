import { healthResponseSchema, type HealthResponse } from '@mantenimiento/shared';

import { getJson } from './client';

export function fetchHealth(options: { signal?: AbortSignal } = {}): Promise<HealthResponse> {
  return getJson('/api/health', healthResponseSchema, options);
}
