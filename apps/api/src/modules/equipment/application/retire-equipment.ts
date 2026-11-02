import type { Equipment } from '../domain/equipment.js';
import { EquipmentNotFoundError } from '../domain/equipment-errors.js';
import type { EquipmentRepository } from '../domain/equipment-repository.js';

/**
 * Use case: retire a piece of equipment (status `RETIRED`), which replaces deletion. Idempotent:
 * equipment that is already retired is returned unchanged, without bumping `updatedAt`. Throws
 * `EquipmentNotFoundError` when it does not exist.
 */
export class RetireEquipmentUseCase {
  constructor(private readonly equipment: EquipmentRepository) {}

  async execute(id: string): Promise<Equipment> {
    const current = await this.equipment.findById(id);
    if (!current) {
      throw new EquipmentNotFoundError(id);
    }
    if (current.status === 'RETIRED') {
      return current;
    }
    const retired = await this.equipment.update(id, { status: 'RETIRED' });
    if (!retired) {
      throw new EquipmentNotFoundError(id);
    }
    return retired;
  }
}
