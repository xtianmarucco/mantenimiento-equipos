import type { EquipmentEvent } from '../domain/equipment-event.js';
import { EquipmentNotFoundError } from '../domain/equipment-errors.js';
import type { EquipmentRepository } from '../domain/equipment-repository.js';

/**
 * Use case: the history of one piece of equipment (retired too), newest first. Throws
 * `EquipmentNotFoundError` when it does not exist.
 */
export class ListEquipmentEventsUseCase {
  constructor(private readonly equipment: EquipmentRepository) {}

  async execute(equipmentId: string): Promise<EquipmentEvent[]> {
    if (!(await this.equipment.findById(equipmentId))) {
      throw new EquipmentNotFoundError(equipmentId);
    }
    return this.equipment.listEvents(equipmentId);
  }
}
