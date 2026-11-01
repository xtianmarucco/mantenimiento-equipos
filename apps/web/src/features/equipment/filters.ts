import { equipmentListQuerySchema, type EquipmentListQuery } from '@mantenimiento/shared';

const FILTER_KEYS = ['status', 'locationId', 'type'] as const;

/**
 * Reads the list filters from the URL query string. Each parameter is validated on its own with
 * the shared query schema; a missing or invalid one is left unset.
 */
export function filtersFromSearchParams(params: URLSearchParams): EquipmentListQuery {
  const filters: EquipmentListQuery = {};
  for (const key of FILTER_KEYS) {
    const parsed = equipmentListQuerySchema.shape[key].safeParse(params.get(key) ?? undefined);
    if (parsed.success && parsed.data !== undefined) {
      Object.assign(filters, { [key]: parsed.data });
    }
  }
  return filters;
}

/** Writes the set filters to a query string, in a stable order. */
export function filtersToSearchParams(filters: EquipmentListQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) {
      params.set(key, value);
    }
  }
  return params;
}
