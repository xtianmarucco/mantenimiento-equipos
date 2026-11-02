import { randomUUID } from 'node:crypto';

import { omitUndefined } from '../../../shared/infrastructure/omit-undefined.js';
import { bySpanishNameThenId } from '../../../shared/infrastructure/spanish-name-order.js';
import type { Location, LocationChanges, NewLocation } from '../domain/location.js';
import type { LocationRepository } from '../domain/location-repository.js';

export interface InMemoryLocationRepositoryOptions {
  /** Initial contents. */
  locations?: readonly Location[];
  /** Clock used for `createdAt`/`updatedAt`; defaults to the system clock. */
  now?: () => Date;
}

/** Adapter: keeps locations in a Map. Used by tests and local experiments; nothing is persisted. */
export class InMemoryLocationRepository implements LocationRepository {
  private readonly store = new Map<string, Location>();
  private readonly now: () => Date;

  constructor(options: InMemoryLocationRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
    for (const location of options.locations ?? []) {
      this.store.set(location.id, location);
    }
  }

  /** Same order as the Prisma adapter (see `LocationRepository.findAll`): name, then id. */
  async findAll(): Promise<Location[]> {
    return [...this.store.values()].sort(bySpanishNameThenId);
  }

  async findById(id: string): Promise<Location | undefined> {
    return this.store.get(id);
  }

  async create(data: NewLocation): Promise<Location> {
    const timestamp = this.now();
    const location: Location = {
      id: randomUUID(),
      name: data.name,
      kind: data.kind,
      address: data.address ?? null,
      contactName: data.contactName ?? null,
      phone: data.phone ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.store.set(location.id, location);
    return location;
  }

  async update(id: string, changes: LocationChanges): Promise<Location | undefined> {
    const current = this.store.get(id);
    if (!current) {
      return undefined;
    }
    const updated: Location = { ...current, ...omitUndefined(changes), updatedAt: this.now() };
    this.store.set(id, updated);
    return updated;
  }
}
