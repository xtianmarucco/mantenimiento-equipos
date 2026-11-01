import { describe, expect, it } from 'vitest';

import type { Location } from '../domain/location.js';
import { LocationNotFoundError } from '../domain/location-not-found-error.js';
import { InMemoryLocationRepository } from '../infrastructure/in-memory-location-repository.js';
import { CreateLocation } from './create-location.js';
import { GetLocation } from './get-location.js';
import { ListLocations } from './list-locations.js';
import { UpdateLocation } from './update-location.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

function location(overrides: Partial<Location> & Pick<Location, 'id' | 'name'>): Location {
  return {
    kind: 'OWN_STORE',
    address: null,
    contactName: null,
    phone: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

/** A clock that advances one second per call, so timestamps are deterministic and ordered. */
function steppingClock(start = '2026-11-01T12:00:00.000Z'): () => Date {
  let current = new Date(start).getTime();
  return () => {
    const now = new Date(current);
    current += 1000;
    return now;
  };
}

describe('ListLocations', () => {
  it('returns every location sorted by name', async () => {
    const repository = new InMemoryLocationRepository({
      locations: [
        location({ id: '3b0c5f3e-0000-4000-8000-000000000003', name: 'Kiosco Norte' }),
        location({ id: '3b0c5f3e-0000-4000-8000-000000000001', name: 'Heladería Centro' }),
        location({ id: '3b0c5f3e-0000-4000-8000-000000000002', name: 'Almacén Sur' }),
      ],
    });

    const result = await new ListLocations(repository).execute();

    expect(result.map((item) => item.name)).toEqual([
      'Almacén Sur',
      'Heladería Centro',
      'Kiosco Norte',
    ]);
  });

  it('returns an empty list when there are no locations', async () => {
    const result = await new ListLocations(new InMemoryLocationRepository()).execute();

    expect(result).toEqual([]);
  });
});

describe('GetLocation', () => {
  it('returns the location with the given id', async () => {
    const stored = location({ id: '3b0c5f3e-0000-4000-8000-000000000001', name: 'Centro' });
    const repository = new InMemoryLocationRepository({ locations: [stored] });

    await expect(new GetLocation(repository).execute(stored.id)).resolves.toEqual(stored);
  });

  it('throws LocationNotFoundError for an unknown id', async () => {
    const getLocation = new GetLocation(new InMemoryLocationRepository());

    await expect(getLocation.execute(MISSING_ID)).rejects.toBeInstanceOf(LocationNotFoundError);
    await expect(getLocation.execute(MISSING_ID)).rejects.toThrow(
      `Location ${MISSING_ID} not found`,
    );
  });
});

describe('CreateLocation', () => {
  it('stores a new location with an id, null optional fields and timestamps', async () => {
    const repository = new InMemoryLocationRepository({ now: steppingClock() });

    const created = await new CreateLocation(repository).execute({
      name: 'Kiosco Plaza',
      kind: 'THIRD_PARTY',
      phone: '+54 11 5555-0199',
    });

    expect(created).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: 'Kiosco Plaza',
      kind: 'THIRD_PARTY',
      address: null,
      contactName: null,
      phone: '+54 11 5555-0199',
      createdAt: new Date('2026-11-01T12:00:00.000Z'),
      updatedAt: new Date('2026-11-01T12:00:00.000Z'),
    });
    await expect(repository.findById(created.id)).resolves.toEqual(created);
  });
});

describe('UpdateLocation', () => {
  it('changes only the given fields, clears fields set to null and bumps updatedAt', async () => {
    const stored = location({
      id: '3b0c5f3e-0000-4000-8000-000000000001',
      name: 'Centro',
      address: 'Av. San Martín 123',
      contactName: 'Ana Pérez',
    });
    const repository = new InMemoryLocationRepository({
      locations: [stored],
      now: steppingClock(),
    });

    const updated = await new UpdateLocation(repository).execute(stored.id, {
      name: 'Heladería Centro',
      contactName: null,
    });

    expect(updated).toEqual({
      ...stored,
      name: 'Heladería Centro',
      contactName: null,
      updatedAt: new Date('2026-11-01T12:00:00.000Z'),
    });
    await expect(repository.findById(stored.id)).resolves.toEqual(updated);
  });

  it('throws LocationNotFoundError for an unknown id', async () => {
    const updateLocation = new UpdateLocation(new InMemoryLocationRepository());

    await expect(updateLocation.execute(MISSING_ID, { name: 'Nuevo' })).rejects.toBeInstanceOf(
      LocationNotFoundError,
    );
  });
});
