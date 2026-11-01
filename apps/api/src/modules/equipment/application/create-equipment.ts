import type { LocationRepository } from '../../locations/domain/location-repository.js';
import type { Equipment, NewEquipment } from '../domain/equipment.js';
import type { EquipmentRepository } from '../domain/equipment-repository.js';
import { ensureLocationExists } from './ensure-location-exists.js';

/**
 * Use case: register new equipment at an existing location. Throws
 * `EquipmentLocationNotFoundError` for an unknown location and `DuplicateEquipmentCodeError` (from
 * the repository) for a code already in use.
 */
export class CreateEquipmentUseCase {
  constructor(
    private readonly equipment: EquipmentRepository,
    private readonly locations: LocationRepository,
  ) {}

  async execute(data: NewEquipment): Promise<Equipment> {
    await ensureLocationExists(this.locations, data.locationId);
    return this.equipment.create(data);
  }
}
