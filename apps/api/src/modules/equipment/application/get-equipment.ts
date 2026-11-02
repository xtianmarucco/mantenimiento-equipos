import type { Equipment } from '../domain/equipment.js';
import { EquipmentNotFoundError } from '../domain/equipment-errors.js';
import type { EquipmentRepository } from '../domain/equipment-repository.js';

/** Use case: fetch one piece of equipment, retired or not. Throws `EquipmentNotFoundError`. */
export class GetEquipmentUseCase {
  constructor(private readonly equipment: EquipmentRepository) {}

  async execute(id: string): Promise<Equipment> {
    const item = await this.equipment.findById(id);
    if (!item) {
      throw new EquipmentNotFoundError(id);
    }
    return item;
  }
}
