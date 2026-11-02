import type { LocationRepository } from '../../locations/domain/location-repository.js';
import { EquipmentLocationNotFoundError } from '../domain/equipment-errors.js';

/**
 * Throws `EquipmentLocationNotFoundError` unless the location exists. The repository enforces the
 * same rule (the foreign key), which covers a location removed between this check and the write.
 */
export async function ensureLocationExists(
  locations: LocationRepository,
  locationId: string,
): Promise<void> {
  if (!(await locations.findById(locationId))) {
    throw new EquipmentLocationNotFoundError(locationId);
  }
}
