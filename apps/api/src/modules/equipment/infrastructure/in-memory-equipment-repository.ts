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
import type {
  EquipmentEvent,
  EquipmentEventEffect,
  NewEquipmentEvent,
  RecordedEquipmentEvent,
} from '../domain/equipment-event.js';
import {
  DuplicateEquipmentCodeError,
  EquipmentEventLocationNotFoundError,
  EquipmentLocationNotFoundError,
  ReplacementEquipmentNotFoundError,
} from '../domain/equipment-errors.js';
import type { EquipmentRepository } from '../domain/equipment-repository.js';

export interface InMemoryEquipmentRepositoryOptions {
  /** Where `locationId` must point, as the database foreign key requires. */
  locations: LocationRepository;
  /** Initial contents (not checked). */
  equipment?: readonly Equipment[];
  /** Initial events (not checked). */
  events?: readonly EquipmentEvent[];
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

/** History order (see `EquipmentRepository.listEvents`): occurredOn, createdAt, id, descending. */
function newestFirst(a: EquipmentEvent, b: EquipmentEvent): number {
  if (a.occurredOn !== b.occurredOn) {
    return a.occurredOn < b.occurredOn ? 1 : -1;
  }
  const byCreatedAt = b.createdAt.getTime() - a.createdAt.getTime();
  if (byCreatedAt !== 0) {
    return byCreatedAt;
  }
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * Adapter: keeps equipment and its events in memory, enforcing the same unique code and location reference as the
 * database. Used by tests and local experiments; nothing is persisted.
 */
export class InMemoryEquipmentRepository implements EquipmentRepository {
  private readonly store = new Map<string, Equipment>();
  private readonly events: EquipmentEvent[] = [];
  private readonly locations: LocationRepository;
  private readonly now: () => Date;

  constructor(options: InMemoryEquipmentRepositoryOptions) {
    this.locations = options.locations;
    this.now = options.now ?? (() => new Date());
    for (const item of options.equipment ?? []) {
      this.store.set(item.id, item);
    }
    this.events.push(...(options.events ?? []));
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

  /**
   * Checks every reference before writing anything, so a rejected event leaves both the history
   * and the equipment as they were, like the Prisma adapter's transaction.
   */
  async recordEvent(
    data: NewEquipmentEvent,
    effect: EquipmentEventEffect,
  ): Promise<RecordedEquipmentEvent | undefined> {
    const current = this.store.get(data.equipmentId);
    if (!current) {
      return undefined;
    }
    await this.checkEventReferences(data);
    await this.checkConstraints(current.id, { locationId: effect.locationId });

    const timestamp = this.now();
    const event: EquipmentEvent = {
      id: randomUUID(),
      equipmentId: data.equipmentId,
      type: data.type,
      occurredOn: data.occurredOn,
      description: data.description,
      technician: data.technician ?? null,
      cost: data.cost ?? null,
      resultingStatus: data.resultingStatus ?? null,
      fromLocationId: data.fromLocationId ?? null,
      toLocationId: data.toLocationId ?? null,
      replacementEquipmentId: data.replacementEquipmentId ?? null,
      createdAt: timestamp,
    };
    const changes = omitUndefined({ status: effect.status, locationId: effect.locationId });
    const equipment: Equipment =
      Object.keys(changes).length === 0
        ? current
        : { ...current, ...changes, updatedAt: timestamp };
    this.events.push(event);
    this.store.set(equipment.id, equipment);
    return { event, equipment };
  }

  async listEvents(equipmentId: string): Promise<EquipmentEvent[]> {
    return this.events.filter((event) => event.equipmentId === equipmentId).sort(newestFirst);
  }

  /** The database's foreign keys from `equipment_events` to `locations` and `equipment`. */
  private async checkEventReferences(data: NewEquipmentEvent): Promise<void> {
    for (const field of ['fromLocationId', 'toLocationId'] as const) {
      const locationId = data[field];
      if (locationId && !(await this.locations.findById(locationId))) {
        throw new EquipmentEventLocationNotFoundError(field, locationId);
      }
    }
    const { replacementEquipmentId } = data;
    if (replacementEquipmentId && !this.store.has(replacementEquipmentId)) {
      throw new ReplacementEquipmentNotFoundError(replacementEquipmentId);
    }
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
