import { beforeEach, describe, expect, it } from 'vitest';

import type { NewLocation } from '../domain/location.js';
import type { LocationRepository } from '../domain/location-repository.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

/** Waits long enough for the next timestamp (millisecond precision) to differ. */
function nextMillisecond(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5));
}

function newLocation(overrides: Partial<NewLocation> = {}): NewLocation {
  return { name: 'Heladería Centro', kind: 'OWN_STORE', ...overrides };
}

/**
 * Behaviour every `LocationRepository` adapter must share. The in-memory adapter runs it in the
 * unit suite and the Prisma adapter against PostgreSQL in the integration suite, so the fake used
 * by the use-case and router tests cannot drift from production.
 *
 * `createRepository` runs before each test and must return an empty repository.
 */
export function describeLocationRepositoryContract(
  adapterName: string,
  createRepository: () => LocationRepository | Promise<LocationRepository>,
): void {
  describe(`${adapterName} (LocationRepository contract)`, () => {
    let repository: LocationRepository;

    beforeEach(async () => {
      repository = await createRepository();
    });

    describe('create and findById', () => {
      it('stores a location with null optional details and returns it by id', async () => {
        const before = Date.now();

        const created = await repository.create(newLocation({ kind: 'THIRD_PARTY' }));

        expect(created).toEqual({
          id: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
          ),
          name: 'Heladería Centro',
          kind: 'THIRD_PARTY',
          address: null,
          contactName: null,
          phone: null,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(created.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
        expect(created.createdAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
        await expect(repository.findById(created.id)).resolves.toEqual(created);
      });

      it('keeps every optional detail that is given', async () => {
        const created = await repository.create(
          newLocation({
            address: 'Av. San Martín 123',
            contactName: 'Ana Pérez',
            phone: '+54 11 5555-0199',
          }),
        );

        const found = await repository.findById(created.id);

        expect(found).toMatchObject({
          address: 'Av. San Martín 123',
          contactName: 'Ana Pérez',
          phone: '+54 11 5555-0199',
        });
        // Timestamps survive the round trip with millisecond precision (TIMESTAMPTZ(3)).
        expect(found?.createdAt.toISOString()).toBe(created.createdAt.toISOString());
        expect(found?.updatedAt.toISOString()).toBe(created.updatedAt.toISOString());
      });

      it('returns undefined for an unknown id', async () => {
        await expect(repository.findById(MISSING_ID)).resolves.toBeUndefined();
      });
    });

    describe('findAll', () => {
      it('returns an empty list when there are no locations', async () => {
        await expect(repository.findAll()).resolves.toEqual([]);
      });

      it('orders by name in Spanish alphabetical order, then by id', async () => {
        // Spanish ICU collation (see `LocationRepository.findAll`): accents and case do not move a
        // name away from its letter ("Álamo" sits with "Alameda", lowercase interleaves with
        // uppercase), "ñ" is its own letter after "n", and "ll" is not ("Llama" before "Luna").
        // Case and accents only break ties between otherwise equal names: lowercase, then
        // uppercase, then accented.
        const names = [
          'Zeta',
          'heladería',
          'Ñandú',
          'Oso',
          'Luna',
          'nube',
          'Álamo',
          'Alameda',
          'Kiosco Norte',
          'ola',
          'alameda',
          'Llama',
          'Almacén',
          'Kiosco Norte',
        ];
        const created = [];
        for (const name of names) {
          created.push(await repository.create(newLocation({ name })));
        }
        const tiedIds = created
          .filter((location) => location.name === 'Kiosco Norte')
          .map((location) => location.id)
          .sort();

        const result = await repository.findAll();

        expect(result.map((location) => location.name)).toEqual([
          'alameda',
          'Alameda',
          'Álamo',
          'Almacén',
          'heladería',
          'Kiosco Norte',
          'Kiosco Norte',
          'Llama',
          'Luna',
          'nube',
          'Ñandú',
          'ola',
          'Oso',
          'Zeta',
        ]);
        expect(
          result.filter((location) => location.name === 'Kiosco Norte').map((l) => l.id),
        ).toEqual(tiedIds);
      });

      it('orders names the collation considers equal by their UTF-8 bytes', async () => {
        // "Álamo" precomposed (U+00C1) and decomposed ("A" + U+0301) are canonically equivalent,
        // so the collation ties; PostgreSQL then compares bytes (0x41 < 0xC3).
        const precomposed = await repository.create(newLocation({ name: '\u00C1lamo' }));
        const decomposed = await repository.create(newLocation({ name: 'A\u0301lamo' }));

        const result = await repository.findAll();

        expect(result.map((location) => location.id)).toEqual([decomposed.id, precomposed.id]);
      });
    });

    describe('update', () => {
      it('changes only the given fields, clears fields set to null and bumps updatedAt', async () => {
        const stored = await repository.create(
          newLocation({ address: 'Av. San Martín 123', contactName: 'Ana Pérez' }),
        );
        await nextMillisecond();

        const updated = await repository.update(stored.id, {
          name: 'Heladería Norte',
          contactName: null,
        });

        expect(updated).toEqual({
          ...stored,
          name: 'Heladería Norte',
          contactName: null,
          updatedAt: expect.any(Date),
        });
        expect(updated?.createdAt).toEqual(stored.createdAt);
        expect(updated?.updatedAt.getTime()).toBeGreaterThan(stored.updatedAt.getTime());
        await expect(repository.findById(stored.id)).resolves.toEqual(updated);
      });

      it('leaves a field untouched when its change is undefined', async () => {
        const stored = await repository.create(newLocation({ phone: '+54 11 5555-0199' }));

        const updated = await repository.update(stored.id, {
          phone: undefined,
          kind: 'THIRD_PARTY',
        });

        expect(updated).toMatchObject({ phone: '+54 11 5555-0199', kind: 'THIRD_PARTY' });
      });

      it('returns undefined for an unknown id and stores nothing', async () => {
        await expect(repository.update(MISSING_ID, { name: 'Nuevo' })).resolves.toBeUndefined();
        await expect(repository.findAll()).resolves.toEqual([]);
      });
    });
  });
}
