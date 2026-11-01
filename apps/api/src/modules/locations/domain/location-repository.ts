import type { Location, LocationChanges, NewLocation } from './location.js';

/** Port: persistence of locations. */
export interface LocationRepository {
  /**
   * Every location, ordered by name in Spanish alphabetical order, then by id for equal names.
   * Spanish order is the ICU `es` collation at its default (tertiary) strength, the column
   * collation `es_natural` in PostgreSQL: letters decide first, so accents and case do not move a
   * name away from its letter and "ñ" follows "n"; accents and case only break ties (lowercase,
   * then uppercase, then accented). Names the collation still considers equal (canonically
   * equivalent spellings) are ordered by their UTF-8 bytes, as PostgreSQL does for deterministic
   * collations. The shared contract suite (`location-repository.contract.ts`) pins this for every
   * adapter.
   */
  findAll(): Promise<Location[]>;
  findById(id: string): Promise<Location | undefined>;
  /** Stores a new location; the repository assigns the id and timestamps. */
  create(data: NewLocation): Promise<Location>;
  /** Applies the changes and bumps `updatedAt`; `undefined` when no location has that id. */
  update(id: string, changes: LocationChanges): Promise<Location | undefined>;
}
