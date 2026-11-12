import type { Equipment, EquipmentChanges, EquipmentFilter, NewEquipment } from './equipment.js';
import type {
  EquipmentEvent,
  EquipmentEventEffect,
  NewEquipmentEvent,
  RecordedEquipmentEvent,
} from './equipment-event.js';

/**
 * Port: persistence of equipment. Like the database, every adapter enforces that `code` is unique
 * (`DuplicateEquipmentCodeError`) and that `locationId` references an existing location
 * (`EquipmentLocationNotFoundError`), so a race past the use case's own checks still fails safely.
 * Events reference existing locations and equipment the same way. The shared contract suites
 * (`equipment-repository.contract.ts`, `equipment-event-repository.contract.ts`) pin this for
 * every adapter.
 */
export interface EquipmentRepository {
  /**
   * Equipment matching the filter (see `EquipmentFilter`: retired equipment only when asked for),
   * ordered by name in Spanish alphabetical order, then by id, the same order as
   * `LocationRepository.findAll` (`equipment.name` uses the `es_natural` collation).
   */
  findAll(filter?: EquipmentFilter): Promise<Equipment[]>;
  findById(id: string): Promise<Equipment | undefined>;
  /** Stores new equipment; the repository assigns the id and timestamps. */
  create(data: NewEquipment): Promise<Equipment>;
  /** Applies the changes and bumps `updatedAt`; `undefined` when no equipment has that id. */
  update(id: string, changes: EquipmentChanges): Promise<Equipment | undefined>;
  /**
   * Stores the event and applies its effect to the equipment atomically: either both are written or
   * neither. `updatedAt` is bumped only when the effect changes something. `undefined` (and nothing
   * stored) when no equipment has `event.equipmentId`. Unknown locations reject with
   * `EquipmentEventLocationNotFoundError` (or `EquipmentLocationNotFoundError` for an effect
   * location the event does not name), unknown replacement equipment with
   * `ReplacementEquipmentNotFoundError`. Business rules (transitions, dates) are the use case's.
   */
  recordEvent(
    event: NewEquipmentEvent,
    effect: EquipmentEventEffect,
  ): Promise<RecordedEquipmentEvent | undefined>;
  /** The equipment's events, newest first: by `occurredOn`, then `createdAt`, then id, descending. */
  listEvents(equipmentId: string): Promise<EquipmentEvent[]>;
}
