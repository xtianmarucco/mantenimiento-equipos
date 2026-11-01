import type { Location, LocationChanges, NewLocation } from './location.js';

/** Port: persistence of locations. */
export interface LocationRepository {
  /** Every location, ordered by name. */
  findAll(): Promise<Location[]>;
  findById(id: string): Promise<Location | undefined>;
  /** Stores a new location; the repository assigns the id and timestamps. */
  create(data: NewLocation): Promise<Location>;
  /** Applies the changes and bumps `updatedAt`; `undefined` when no location has that id. */
  update(id: string, changes: LocationChanges): Promise<Location | undefined>;
}
