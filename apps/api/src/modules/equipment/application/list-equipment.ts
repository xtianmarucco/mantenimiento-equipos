import type { Equipment, EquipmentFilter } from '../domain/equipment.js';
import type { EquipmentRepository } from '../domain/equipment-repository.js';

/**
 * Use case: list equipment matching the filter, ordered by name. Without a `status` filter retired
 * equipment is left out (see `EquipmentFilter`).
 */
export class ListEquipmentUseCase {
  constructor(private readonly equipment: EquipmentRepository) {}

  execute(filter: EquipmentFilter = {}): Promise<Equipment[]> {
    return this.equipment.findAll(filter);
  }
}
