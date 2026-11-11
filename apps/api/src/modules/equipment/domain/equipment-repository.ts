import type { Equipment, EquipmentChanges, EquipmentFilter, NewEquipment } from './equipment.js';

/**
 * Port: persistence of equipment. Like the database, every adapter enforces that `code` is unique
 * (`DuplicateEquipmentCodeError`) and that `locationId` references an existing location
 * (`EquipmentLocationNotFoundError`), so a race past the use case's own checks still fails safely.
 * The shared contract suite (`equipment-repository.contract.ts`) pins this for every adapter.
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
}
