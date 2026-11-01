import { randomUUID } from 'node:crypto';

import { omitUndefined } from '../../../shared/infrastructure/omit-undefined.js';
import type { Location, LocationChanges, NewLocation } from '../domain/location.js';
import type { LocationRepository } from '../domain/location-repository.js';

export interface InMemoryLocationRepositoryOptions {
  /** Initial contents. */
  locations?: readonly Location[];
  /** Clock used for `createdAt`/`updatedAt`; defaults to the system clock. */
  now?: () => Date;
}

/**
 * ICU Spanish at its default (tertiary) strength, as the `es_natural` column collation. Two ICU
 * builds are coupled here: this uses Node's bundled ICU (78.3 on Node 26), the database uses the
 * postgres image's icu-libs (78.1 in `postgres:18.6-alpine3.24`). Unit tests only check Node
 * against itself; the integration contract suite is what catches a disagreement, so rerun it when
 * either Node or the image changes (README "Collation version").
 */
const spanish = new Intl.Collator('es', { usage: 'sort', sensitivity: 'variant' });

/**
 * UTF-8 byte order, which is code point order: PostgreSQL's tie-break for names a deterministic
 * collation considers equal, and the order of lowercase UUID strings. Plain `<` compares UTF-16
 * code units, which misplaces characters outside the Basic Multilingual Plane.
 */
function byUtf8Bytes(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/** Same order as the Prisma adapter (see `LocationRepository.findAll`): name, then id. */
function byNameThenId(a: Location, b: Location): number {
  return spanish.compare(a.name, b.name) || byUtf8Bytes(a.name, b.name) || byUtf8Bytes(a.id, b.id);
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

  async findAll(): Promise<Location[]> {
    return [...this.store.values()].sort(byNameThenId);
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
