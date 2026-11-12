import { ConflictError } from '../../../shared/domain/conflict-error.js';
import { DomainValidationError } from '../../../shared/domain/domain-validation-error.js';
import { NotFoundError } from '../../../shared/domain/not-found-error.js';

/** No equipment exists with the requested id. */
export class EquipmentNotFoundError extends NotFoundError {
  readonly equipmentId: string;

  constructor(equipmentId: string) {
    super(`Equipment ${equipmentId} not found`);
    this.equipmentId = equipmentId;
  }
}

/** Another piece of equipment already has this code. */
export class DuplicateEquipmentCodeError extends ConflictError {
  readonly code: string;

  constructor(code: string) {
    super(`Equipment code ${code} is already in use`);
    this.code = code;
  }
}

/** The equipment would be placed at a location that does not exist. */
export class EquipmentLocationNotFoundError extends DomainValidationError {
  readonly locationId: string;

  constructor(locationId: string) {
    super(`Location ${locationId} not found`, [
      { path: 'locationId', message: 'Location does not exist' },
    ]);
    this.locationId = locationId;
  }
}

/** The warranty would end before the purchase date (taking the stored value for the date not sent). */
export class WarrantyBeforePurchaseError extends DomainValidationError {
  constructor() {
    super('Warranty cannot end before the purchase date', [
      { path: 'warrantyUntil', message: 'Warranty cannot end before the purchase date' },
    ]);
  }
}

/** An event would reference a location that does not exist, at `fromLocationId` or `toLocationId`. */
export class EquipmentEventLocationNotFoundError extends DomainValidationError {
  readonly locationId: string;

  constructor(field: 'fromLocationId' | 'toLocationId', locationId: string) {
    super(`Location ${locationId} not found`, [
      { path: field, message: 'Location does not exist' },
    ]);
    this.locationId = locationId;
  }
}

/** A replacement event would name replacement equipment that does not exist. */
export class ReplacementEquipmentNotFoundError extends DomainValidationError {
  readonly equipmentId: string;

  constructor(equipmentId: string) {
    super(`Equipment ${equipmentId} not found`, [
      { path: 'replacementEquipmentId', message: 'Equipment does not exist' },
    ]);
    this.equipmentId = equipmentId;
  }
}
