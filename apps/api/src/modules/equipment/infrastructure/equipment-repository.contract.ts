import { beforeEach, describe, expect, it } from 'vitest';

import type { LocationRepository } from '../../locations/domain/location-repository.js';
import type { Equipment, EquipmentFilter, NewEquipment } from '../domain/equipment.js';
import {
  DuplicateEquipmentCodeError,
  EquipmentLocationNotFoundError,
} from '../domain/equipment-errors.js';
import type { EquipmentRepository } from '../domain/equipment-repository.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Waits long enough for the next timestamp (millisecond precision) to differ. */
function nextMillisecond(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5));
}

/** Both repositories, empty. The equipment one must check `locationId` against `locations`. */
export interface EquipmentRepositoryFixture {
  equipment: EquipmentRepository;
  locations: LocationRepository;
}

/**
 * Behaviour every `EquipmentRepository` adapter must share. The in-memory adapter runs it in the
 * unit suite and the Prisma adapter against PostgreSQL in the integration suite, so the fake used
 * by the use-case and router tests cannot drift from production.
 *
 * `createFixture` runs before each test and must return empty repositories.
 */
export function describeEquipmentRepositoryContract(
  adapterName: string,
  createFixture: () => EquipmentRepositoryFixture | Promise<EquipmentRepositoryFixture>,
): void {
  describe(`${adapterName} (EquipmentRepository contract)`, () => {
    let repository: EquipmentRepository;
    let centroId: string;
    let kioscoId: string;
    let codeCounter: number;

    /** Valid new equipment at "Centro" with a fresh code; overrides win. */
    function newEquipment(overrides: Partial<NewEquipment> = {}): NewEquipment {
      codeCounter += 1;
      return {
        code: `EQ-${String(codeCounter).padStart(4, '0')}`,
        name: 'Freezer horizontal',
        type: 'FREEZER',
        brand: 'Gafa',
        model: 'HGF-350',
        purchaseDate: '2024-03-15',
        status: 'OPERATIONAL',
        locationId: centroId,
        ...overrides,
      };
    }

    beforeEach(async () => {
      const fixture = await createFixture();
      repository = fixture.equipment;
      codeCounter = 0;
      centroId = (await fixture.locations.create({ name: 'Centro', kind: 'OWN_STORE' })).id;
      kioscoId = (await fixture.locations.create({ name: 'Kiosco', kind: 'THIRD_PARTY' })).id;
    });

    describe('create and findById', () => {
      it('stores equipment with null optional details and returns it by id', async () => {
        const before = Date.now();

        const created = await repository.create(newEquipment({ code: 'EQ-0042' }));

        expect(created).toEqual({
          id: expect.stringMatching(UUID),
          code: 'EQ-0042',
          name: 'Freezer horizontal',
          type: 'FREEZER',
          brand: 'Gafa',
          model: 'HGF-350',
          serialNumber: null,
          purchaseDate: '2024-03-15',
          warrantyUntil: null,
          status: 'OPERATIONAL',
          locationId: centroId,
          notes: null,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(created.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
        expect(created.createdAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
        await expect(repository.findById(created.id)).resolves.toEqual(created);
      });

      it('keeps every optional detail and maps date-only fields without shifting them', async () => {
        // Leap day and year-end dates catch any time-zone or month arithmetic in the mapping.
        const created = await repository.create(
          newEquipment({
            type: 'ICE_CREAM_MACHINE',
            serialNumber: 'SN-123/A',
            purchaseDate: '2024-02-29',
            warrantyUntil: '2026-12-31',
            status: 'IN_REPAIR',
            locationId: kioscoId,
            notes: 'Compresor cambiado en 2025',
          }),
        );

        const found = await repository.findById(created.id);

        expect(found).toMatchObject({
          type: 'ICE_CREAM_MACHINE',
          serialNumber: 'SN-123/A',
          purchaseDate: '2024-02-29',
          warrantyUntil: '2026-12-31',
          status: 'IN_REPAIR',
          locationId: kioscoId,
          notes: 'Compresor cambiado en 2025',
        });
        // Timestamps survive the round trip with millisecond precision (TIMESTAMPTZ(3)).
        expect(found?.createdAt.toISOString()).toBe(created.createdAt.toISOString());
        expect(found?.updatedAt.toISOString()).toBe(created.updatedAt.toISOString());
      });

      it('returns undefined for an unknown id', async () => {
        await expect(repository.findById(MISSING_ID)).resolves.toBeUndefined();
      });

      it('rejects a code that is already taken and stores nothing', async () => {
        await repository.create(newEquipment({ code: 'EQ-0001' }));

        const error: unknown = await repository
          .create(newEquipment({ code: 'EQ-0001', name: 'Otra' }))
          .then(
            () => undefined,
            (reason: unknown) => reason,
          );

        expect(error).toBeInstanceOf(DuplicateEquipmentCodeError);
        expect(error).toMatchObject({ code: 'EQ-0001' });
        await expect(repository.findAll()).resolves.toHaveLength(1);
      });

      it('rejects a location that does not exist and stores nothing', async () => {
        await expect(
          repository.create(newEquipment({ locationId: MISSING_ID })),
        ).rejects.toBeInstanceOf(EquipmentLocationNotFoundError);
        await expect(repository.findAll()).resolves.toEqual([]);
      });
    });

    describe('findAll', () => {
      it('returns an empty list when there is no equipment', async () => {
        await expect(repository.findAll()).resolves.toEqual([]);
      });

      it('orders by name in Spanish alphabetical order, then by id', async () => {
        // Same rule as the locations (`es_natural`): accents and case stay with their letter, "ñ"
        // follows "n", and equal names fall back to the id.
        const names = ['Vitrina', 'ñandú', 'Heladera', 'nube', 'Árbol', 'Vitrina', 'freezer'];
        const created: Equipment[] = [];
        for (const name of names) {
          created.push(await repository.create(newEquipment({ name })));
        }
        const tiedIds = created
          .filter((item) => item.name === 'Vitrina')
          .map((item) => item.id)
          .sort();

        const result = await repository.findAll();

        expect(result.map((item) => item.name)).toEqual([
          'Árbol',
          'freezer',
          'Heladera',
          'nube',
          'ñandú',
          'Vitrina',
          'Vitrina',
        ]);
        expect(result.filter((item) => item.name === 'Vitrina').map((item) => item.id)).toEqual(
          tiedIds,
        );
      });

      describe('filters', () => {
        beforeEach(async () => {
          await repository.create(newEquipment({ name: 'A freezer centro' }));
          await repository.create(
            newEquipment({ name: 'B vitrina centro', type: 'DISPLAY_CASE', status: 'IN_REPAIR' }),
          );
          await repository.create(newEquipment({ name: 'C freezer kiosco', locationId: kioscoId }));
          await repository.create(newEquipment({ name: 'D retirado centro', status: 'RETIRED' }));
          await repository.create(
            newEquipment({
              name: 'E retirado kiosco',
              status: 'RETIRED',
              type: 'DISPLAY_CASE',
              locationId: kioscoId,
            }),
          );
        });

        async function namesFor(filter: EquipmentFilter | undefined): Promise<string[]> {
          return (await repository.findAll(filter)).map((item) => item.name);
        }

        it('leaves retired equipment out when no status is given', async () => {
          const expected = ['A freezer centro', 'B vitrina centro', 'C freezer kiosco'];

          await expect(namesFor(undefined)).resolves.toEqual(expected);
          await expect(namesFor({})).resolves.toEqual(expected);
          await expect(namesFor({ status: undefined })).resolves.toEqual(expected);
        });

        it('lists only retired equipment for status RETIRED', async () => {
          await expect(namesFor({ status: 'RETIRED' })).resolves.toEqual([
            'D retirado centro',
            'E retirado kiosco',
          ]);
        });

        it('filters by any other status', async () => {
          await expect(namesFor({ status: 'IN_REPAIR' })).resolves.toEqual(['B vitrina centro']);
          await expect(namesFor({ status: 'OUT_OF_SERVICE' })).resolves.toEqual([]);
        });

        it('filters by location, still leaving retired equipment out', async () => {
          await expect(namesFor({ locationId: kioscoId })).resolves.toEqual(['C freezer kiosco']);
          await expect(namesFor({ locationId: MISSING_ID })).resolves.toEqual([]);
        });

        it('filters by type, still leaving retired equipment out', async () => {
          await expect(namesFor({ type: 'DISPLAY_CASE' })).resolves.toEqual(['B vitrina centro']);
        });

        it('combines filters with AND', async () => {
          await expect(
            namesFor({ status: 'RETIRED', type: 'DISPLAY_CASE', locationId: kioscoId }),
          ).resolves.toEqual(['E retirado kiosco']);
          await expect(namesFor({ type: 'FREEZER', locationId: centroId })).resolves.toEqual([
            'A freezer centro',
          ]);
        });
      });
    });

    describe('update', () => {
      it('changes only the given fields, clears fields set to null and bumps updatedAt', async () => {
        const stored = await repository.create(
          newEquipment({
            serialNumber: 'SN-1',
            warrantyUntil: '2025-03-15',
            notes: 'Nota',
          }),
        );
        await nextMillisecond();

        const updated = await repository.update(stored.id, {
          name: 'Freezer vertical',
          purchaseDate: '2024-01-31',
          serialNumber: null,
          warrantyUntil: null,
          notes: null,
          locationId: kioscoId,
        });

        expect(updated).toEqual({
          ...stored,
          name: 'Freezer vertical',
          purchaseDate: '2024-01-31',
          serialNumber: null,
          warrantyUntil: null,
          notes: null,
          locationId: kioscoId,
          updatedAt: expect.any(Date),
        });
        expect(updated?.createdAt).toEqual(stored.createdAt);
        expect(updated?.updatedAt.getTime()).toBeGreaterThan(stored.updatedAt.getTime());
        await expect(repository.findById(stored.id)).resolves.toEqual(updated);
      });

      it('leaves a field untouched when its change is undefined', async () => {
        const stored = await repository.create(newEquipment({ serialNumber: 'SN-1' }));

        const updated = await repository.update(stored.id, {
          serialNumber: undefined,
          status: 'RETIRED',
        });

        expect(updated).toMatchObject({ serialNumber: 'SN-1', status: 'RETIRED' });
      });

      it('accepts the equipment keeping its own code', async () => {
        const stored = await repository.create(newEquipment({ code: 'EQ-0007' }));

        await expect(repository.update(stored.id, { code: 'EQ-0007' })).resolves.toMatchObject({
          code: 'EQ-0007',
        });
      });

      it('rejects a code taken by other equipment and keeps the stored record', async () => {
        await repository.create(newEquipment({ code: 'EQ-0001' }));
        const stored = await repository.create(newEquipment({ code: 'EQ-0002' }));

        await expect(
          repository.update(stored.id, { code: 'EQ-0001', name: 'Cambiado' }),
        ).rejects.toBeInstanceOf(DuplicateEquipmentCodeError);
        await expect(repository.findById(stored.id)).resolves.toEqual(stored);
      });

      it('rejects a location that does not exist and keeps the stored record', async () => {
        const stored = await repository.create(newEquipment());

        await expect(
          repository.update(stored.id, { locationId: MISSING_ID }),
        ).rejects.toBeInstanceOf(EquipmentLocationNotFoundError);
        await expect(repository.findById(stored.id)).resolves.toEqual(stored);
      });

      it('returns undefined for an unknown id and stores nothing', async () => {
        await expect(repository.update(MISSING_ID, { name: 'Nuevo' })).resolves.toBeUndefined();
        await expect(repository.findAll({})).resolves.toEqual([]);
      });
    });
  });
}
