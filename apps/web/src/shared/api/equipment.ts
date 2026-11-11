import {
  equipmentResponseSchema,
  type CreateEquipmentInput,
  type EquipmentListQuery,
  type EquipmentResponse,
  type UpdateEquipmentInput,
} from '@mantenimiento/shared';
import { z } from 'zod';

import { getJson, sendJson } from './client';

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

function equipmentPath(id: string): string {
  return `/api/equipment/${encodeURIComponent(id)}`;
}

/** Gets one equipment item; a missing id rejects with an `ApiError` with status 404. */
export function getEquipment(
  id: string,
  options: { signal?: AbortSignal } = {},
): Promise<EquipmentResponse> {
  return getJson(equipmentPath(id), equipmentResponseSchema, options);
}

/** Creates equipment; a duplicate code rejects with status 409, invalid input with 400. */
export function createEquipment(input: CreateEquipmentInput): Promise<EquipmentResponse> {
  return sendJson('POST', '/api/equipment', equipmentResponseSchema, { body: input });
}

/** Updates only the given fields; `null` clears an optional field. */
export function updateEquipment(
  id: string,
  changes: UpdateEquipmentInput,
): Promise<EquipmentResponse> {
  return sendJson('PATCH', equipmentPath(id), equipmentResponseSchema, { body: changes });
}

/** Retires equipment (status `RETIRED`); retiring it again is a no-op. */
export function retireEquipment(id: string): Promise<EquipmentResponse> {
  return sendJson('POST', `${equipmentPath(id)}/retire`, equipmentResponseSchema);
}
