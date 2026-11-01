import type { Location } from '../domain/location.js';
import { LocationNotFoundError } from '../domain/location-not-found-error.js';
import type { LocationRepository } from '../domain/location-repository.js';

/** Use case: fetch one location. Throws `LocationNotFoundError` when it does not exist. */
export class GetLocation {
  constructor(private readonly locations: LocationRepository) {}

  async execute(id: string): Promise<Location> {
    const location = await this.locations.findById(id);
    if (!location) {
      throw new LocationNotFoundError(id);
    }
    return location;
  }
}
