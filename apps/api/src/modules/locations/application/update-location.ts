import type { Location, LocationChanges } from '../domain/location.js';
import { LocationNotFoundError } from '../domain/location-not-found-error.js';
import type { LocationRepository } from '../domain/location-repository.js';

/** Use case: change some details of a location. Throws `LocationNotFoundError` when it does not exist. */
export class UpdateLocation {
  constructor(private readonly locations: LocationRepository) {}

  async execute(id: string, changes: LocationChanges): Promise<Location> {
    const location = await this.locations.update(id, changes);
    if (!location) {
      throw new LocationNotFoundError(id);
    }
    return location;
  }
}
