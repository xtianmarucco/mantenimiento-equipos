import type { LocationRepository } from '../../locations/domain/location-repository.js';
import type { Equipment, EquipmentChanges } from '../domain/equipment.js';
import { EquipmentNotFoundError, WarrantyBeforePurchaseError } from '../domain/equipment-errors.js';
import type { EquipmentRepository } from '../domain/equipment-repository.js';
import { ensureLocationExists } from './ensure-location-exists.js';

/**
 * The warranty cannot end before the purchase date. A date left out of the changes keeps its stored
 * value, so sending only one of them is checked against the other as stored.
 */
function ensureWarrantyNotBeforePurchase(current: Equipment, changes: EquipmentChanges): void {
  const purchaseDate = changes.purchaseDate ?? current.purchaseDate;
  const warrantyUntil =
    changes.warrantyUntil === undefined ? current.warrantyUntil : changes.warrantyUntil;
  if (warrantyUntil !== null && warrantyUntil < purchaseDate) {
    throw new WarrantyBeforePurchaseError();
  }
}

/**
 * Use case: change some details of a piece of equipment, including its status (`RETIRED` too; see
 * `RetireEquipmentUseCase` for the dedicated, idempotent action). Throws `EquipmentNotFoundError`,
 * `EquipmentLocationNotFoundError`, `WarrantyBeforePurchaseError`, or `DuplicateEquipmentCodeError`
 * (from the repository).
 */
export class UpdateEquipmentUseCase {
  constructor(
    private readonly equipment: EquipmentRepository,
    private readonly locations: LocationRepository,
  ) {}

  async execute(id: string, changes: EquipmentChanges): Promise<Equipment> {
    const current = await this.equipment.findById(id);
    if (!current) {
      throw new EquipmentNotFoundError(id);
    }
    if (changes.locationId !== undefined) {
      await ensureLocationExists(this.locations, changes.locationId);
    }
    ensureWarrantyNotBeforePurchase(current, changes);

    // `undefined` here means the record was removed after it was read.
    const updated = await this.equipment.update(id, changes);
    if (!updated) {
      throw new EquipmentNotFoundError(id);
    }
    return updated;
  }
}
