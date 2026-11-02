import {
  equipmentResponseSchema,
  type EquipmentListQuery,
  type EquipmentResponse,
} from '@mantenimiento/shared';
import { z } from 'zod';

import { getJson } from './client';

const equipmentListSchema = z.array(equipmentResponseSchema);

/** Path of `GET /api/equipment`; the query string carries only the filters that are set. */
export function buildEquipmentListPath(filters: EquipmentListQuery): string {
  const params = new URLSearchParams();
  for (const key of ['status', 'locationId', 'type'] as const) {
    const value = filters[key];
    if (value) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `/api/equipment?${query}` : '/api/equipment';
}

/** Lists equipment; without a `status` filter the API leaves out retired equipment. */
export function listEquipment(
  filters: EquipmentListQuery,
  options: { signal?: AbortSignal } = {},
): Promise<EquipmentResponse[]> {
  return getJson(buildEquipmentListPath(filters), equipmentListSchema, options);
}
