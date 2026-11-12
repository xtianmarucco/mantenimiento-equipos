import type { Equipment, EquipmentDetailChanges } from '../domain/equipment.js';
import { EquipmentNotFoundError, WarrantyBeforePurchaseError } from '../domain/equipment-errors.js';
import type { EquipmentRepository } from '../domain/equipment-repository.js';

/**
 * The warranty cannot end before the purchase date. A date left out of the changes keeps its stored
 * value, so sending only one of them is checked against the other as stored.
 */
function ensureWarrantyNotBeforePurchase(
  current: Equipment,
  changes: EquipmentDetailChanges,
): void {
  const purchaseDate = changes.purchaseDate ?? current.purchaseDate;
  const warrantyUntil =
    changes.warrantyUntil === undefined ? current.warrantyUntil : changes.warrantyUntil;
  if (warrantyUntil !== null && warrantyUntil < purchaseDate) {
    throw new WarrantyBeforePurchaseError();
  }
}

/**
 * Only the details an update may change. Status and location change only through events
 * (`RecordEquipmentEventUseCase`), so they are never copied, even if a caller passes them.
 */
function detailsOnly({
  code,
  name,
  type,
  brand,
  model,
  serialNumber,
  purchaseDate,
  warrantyUntil,
  notes,
}: EquipmentDetailChanges): EquipmentDetailChanges {
  return { code, name, type, brand, model, serialNumber, purchaseDate, warrantyUntil, notes };
}

/**
 * Use case: change some details of a piece of equipment; never its status or location, which change
 * only through equipment events. Throws `EquipmentNotFoundError`, `WarrantyBeforePurchaseError`, or
 * `DuplicateEquipmentCodeError` (from the repository).
 */
export class UpdateEquipmentUseCase {
  constructor(private readonly equipment: EquipmentRepository) {}

  async execute(id: string, changes: EquipmentDetailChanges): Promise<Equipment> {
    const current = await this.equipment.findById(id);
    if (!current) {
      throw new EquipmentNotFoundError(id);
    }
    const details = detailsOnly(changes);
    ensureWarrantyNotBeforePurchase(current, details);

    // `undefined` here means the record was removed after it was read.
    const updated = await this.equipment.update(id, details);
    if (!updated) {
      throw new EquipmentNotFoundError(id);
    }
    return updated;
  }
}
