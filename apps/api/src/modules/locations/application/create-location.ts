import type { Location, NewLocation } from '../domain/location.js';
import type { LocationRepository } from '../domain/location-repository.js';

/** Use case: register a new location. */
export class CreateLocation {
  constructor(private readonly locations: LocationRepository) {}

  execute(data: NewLocation): Promise<Location> {
    return this.locations.create(data);
  }
}
