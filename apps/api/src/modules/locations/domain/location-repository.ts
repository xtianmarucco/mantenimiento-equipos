import type { Location, LocationChanges, NewLocation } from './location.js';

/** Port: persistence of locations. */
export interface LocationRepository {
  /**
   * Every location, ordered by name, then by id for equal names. Name order is the PostgreSQL
   * database collation; on the reference image (`postgres:18-alpine`, musl libc) that is Unicode
   * code point order (uppercase before lowercase, accented letters after `z`), not dictionary
   * order. The shared contract suite (`location-repository.contract.ts`) pins this for every
   * adapter, so a database with a different collation fails the integration tests.
   */
  findAll(): Promise<Location[]>;
  findById(id: string): Promise<Location | undefined>;
  /** Stores a new location; the repository assigns the id and timestamps. */
  create(data: NewLocation): Promise<Location>;
  /** Applies the changes and bumps `updatedAt`; `undefined` when no location has that id. */
  update(id: string, changes: LocationChanges): Promise<Location | undefined>;
}
