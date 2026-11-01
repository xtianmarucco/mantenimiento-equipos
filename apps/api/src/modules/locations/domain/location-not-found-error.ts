import { NotFoundError } from '../../../shared/domain/not-found-error.js';

/** No location exists with the requested id. */
export class LocationNotFoundError extends NotFoundError {
  readonly locationId: string;

  constructor(locationId: string) {
    super(`Location ${locationId} not found`);
    this.locationId = locationId;
  }
}
