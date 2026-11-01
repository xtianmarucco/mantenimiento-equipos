import { randomUUID } from 'node:crypto';

import { omitUndefined } from '../../../shared/infrastructure/omit-undefined.js';
import { bySpanishNameThenId } from '../../../shared/infrastructure/spanish-name-order.js';
import type { LocationRepository } from '../../locations/domain/location-repository.js';
import type {
  Equipment,
  EquipmentChanges,
  EquipmentFilter,
  NewEquipment,
} from '../domain/equipment.js';
import {
  DuplicateEquipmentCodeError,
  EquipmentLocationNotFoundError,
} from '../domain/equipment-errors.js';
import type { EquipmentRepository } from '../domain/equipment-repository.js';

export interface InMemoryEquipmentRepositoryOptions {
  /** Where `locationId` must point, as the database foreign key requires. */
  locations: LocationRepository;
  /** Initial contents (not checked). */
  equipment?: readonly Equipment[];
  /** Clock used for `createdAt`/`updatedAt`; defaults to the system clock. */
  now?: () => Date;
}

function matches(item: Equipment, filter: EquipmentFilter): boolean {
  const statusMatches =
    filter.status === undefined ? item.status !== 'RETIRED' : item.status === filter.status;
  return (
    statusMatches &&
    (filter.locationId === undefined || item.locationId === filter.locationId) &&
    (filter.type === undefined || item.type === filter.type)
  );
}

/**
 * Adapter: keeps equipment in a Map, enforcing the same unique code and location reference as the
 * database. Used by tests and local experiments; nothing is persisted.
 */
export class InMemoryEquipmentRepository implements EquipmentRepository {
  private readonly store = new Map<string, Equipment>();
  private readonly locations: LocationRepository;
  private readonly now: () => Date;

  constructor(options: InMemoryEquipmentRepositoryOptions) {
    this.locations = options.locations;
    this.now = options.now ?? (() => new Date());
    for (const item of options.equipment ?? []) {
      this.store.set(item.id, item);
    }
  }

  /** Same order as the Prisma adapter (see `EquipmentRepository.findAll`): name, then id. */
  async findAll(filter: EquipmentFilter = {}): Promise<Equipment[]> {
    return [...this.store.values()]
      .filter((item) => matches(item, filter))
      .sort(bySpanishNameThenId);
  }

  async findById(id: string): Promise<Equipment | undefined> {
    return this.store.get(id);
  }

  async create(data: NewEquipment): Promise<Equipment> {
    await this.checkConstraints(undefined, data);
    const timestamp = this.now();
    const item: Equipment = {
      id: randomUUID(),
      code: data.code,
      name: data.name,
      type: data.type,
      brand: data.brand,
      model: data.model,
      serialNumber: data.serialNumber ?? null,
      purchaseDate: data.purchaseDate,
      warrantyUntil: data.warrantyUntil ?? null,
      status: data.status,
      locationId: data.locationId,
      notes: data.notes ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.store.set(item.id, item);
    return item;
  }

  async update(id: string, changes: EquipmentChanges): Promise<Equipment | undefined> {
    const current = this.store.get(id);
    if (!current) {
      return undefined;
    }
    await this.checkConstraints(id, changes);
    const updated: Equipment = { ...current, ...omitUndefined(changes), updatedAt: this.now() };
    this.store.set(id, updated);
    return updated;
  }

  /** The database's unique `code` and `location_id` foreign key, for the record `id` (if any). */
  private async checkConstraints(id: string | undefined, data: EquipmentChanges): Promise<void> {
    const { code, locationId } = data;
    if (code !== undefined) {
      const taken = [...this.store.values()].some((item) => item.code === code && item.id !== id);
      if (taken) {
        throw new DuplicateEquipmentCodeError(code);
      }
    }
    if (locationId !== undefined && !(await this.locations.findById(locationId))) {
      throw new EquipmentLocationNotFoundError(locationId);
    }
  }
}
