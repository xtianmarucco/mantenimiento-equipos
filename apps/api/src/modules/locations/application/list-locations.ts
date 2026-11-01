import type { Location } from '../domain/location.js';
import type { LocationRepository } from '../domain/location-repository.js';

/** Use case: list every location, ordered by name. */
export class ListLocations {
  constructor(private readonly locations: LocationRepository) {}

  execute(): Promise<Location[]> {
    return this.locations.findAll();
  }
}
