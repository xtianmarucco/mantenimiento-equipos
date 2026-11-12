import { beforeEach, describe, expect, it } from 'vitest';

import type { Equipment, NewEquipment } from '../domain/equipment.js';
import type { NewEquipmentEvent } from '../domain/equipment-event.js';
import {
  EquipmentEventLocationNotFoundError,
  EquipmentLocationNotFoundError,
  ReplacementEquipmentNotFoundError,
} from '../domain/equipment-errors.js';
import type { EquipmentRepository } from '../domain/equipment-repository.js';
import type { EquipmentRepositoryFixture } from './equipment-repository.contract.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Waits long enough for the next timestamp (millisecond precision) to differ. */
function nextMillisecond(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5));
}

/** Settles a promise into its rejection reason (`undefined` when it resolves). */
function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
}

/**
 * Event behaviour every `EquipmentRepository` adapter must share (`recordEvent`, `listEvents`).
 * Run next to `describeEquipmentRepositoryContract` with the same fixture: the in-memory adapter
 * in the unit suite, the Prisma adapter against PostgreSQL in the integration suite.
 *
 * Only persistence is pinned here; which event types are allowed from which status is the use
 * case's rule.
 */
export function describeEquipmentEventRepositoryContract(
  adapterName: string,
  createFixture: () => EquipmentRepositoryFixture | Promise<EquipmentRepositoryFixture>,
): void {
  describe(`${adapterName} (EquipmentRepository events contract)`, () => {
    let repository: EquipmentRepository;
    let centroId: string;
    let kioscoId: string;
    let codeCounter: number;

    async function storedEquipment(overrides: Partial<NewEquipment> = {}): Promise<Equipment> {
      codeCounter += 1;
      return repository.create({
        code: `EQ-${String(codeCounter).padStart(4, '0')}`,
        name: 'Freezer horizontal',
        type: 'FREEZER',
        brand: 'Gafa',
        model: 'HGF-350',
        purchaseDate: '2024-03-15',
        status: 'OPERATIONAL',
        locationId: centroId,
        ...overrides,
      });
    }

    function newEvent(
      equipmentId: string,
      overrides: Partial<NewEquipmentEvent> = {},
    ): NewEquipmentEvent {
      return {
        equipmentId,
        type: 'MAINTENANCE',
        occurredOn: '2026-11-10',
        description: 'Limpieza de condensador',
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

    describe('recordEvent', () => {
      it('stores an event with null type-specific fields and leaves the equipment untouched', async () => {
        const stored = await storedEquipment();
        await nextMillisecond();
        const before = Date.now();

        const recorded = await repository.recordEvent(
          newEvent(stored.id, { type: 'RETIREMENT', description: 'Sin arreglo posible' }),
          {},
        );

        expect(recorded?.event).toEqual({
          id: expect.stringMatching(UUID),
          equipmentId: stored.id,
          type: 'RETIREMENT',
          occurredOn: '2026-11-10',
          description: 'Sin arreglo posible',
          technician: null,
          cost: null,
          resultingStatus: null,
          fromLocationId: null,
          toLocationId: null,
          replacementEquipmentId: null,
          createdAt: expect.any(Date),
        });
        expect(recorded?.event.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
        expect(recorded?.event.createdAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
        // No effect: same record, updatedAt included.
        expect(recorded?.equipment).toEqual(stored);
        await expect(repository.findById(stored.id)).resolves.toEqual(stored);
        await expect(repository.listEvents(stored.id)).resolves.toEqual([recorded?.event]);
      });

      it('treats an effect whose fields are undefined as no change', async () => {
        const stored = await storedEquipment();
        await nextMillisecond();

        const recorded = await repository.recordEvent(newEvent(stored.id), {
          status: undefined,
          locationId: undefined,
        });

        expect(recorded?.equipment).toEqual(stored);
        await expect(repository.findById(stored.id)).resolves.toEqual(stored);
      });

      it('stores technician and cost, and maps the date without shifting it', async () => {
        const stored = await storedEquipment({ purchaseDate: '2024-01-10' });

        const recorded = await repository.recordEvent(
          newEvent(stored.id, {
            type: 'REPAIR',
            occurredOn: '2024-02-29',
            technician: 'Frío Sur',
            cost: 15000.5,
          }),
          {},
        );

        const [listed] = await repository.listEvents(stored.id);
        expect(listed).toEqual(recorded?.event);
        expect(listed).toMatchObject({
          type: 'REPAIR',
          occurredOn: '2024-02-29',
          technician: 'Frío Sur',
          cost: 15000.5,
        });
        // TIMESTAMPTZ(3): createdAt survives the round trip with millisecond precision.
        expect(listed?.createdAt.toISOString()).toBe(recorded?.event.createdAt.toISOString());
      });

      it.each([0, 0.01, 0.1, 42000, 99_999_999.99])(
        'keeps a cost of %d exactly as a number',
        async (cost) => {
          const stored = await storedEquipment();

          await repository.recordEvent(newEvent(stored.id, { cost }), {});

          const [listed] = await repository.listEvents(stored.id);
          expect(listed?.cost).toBe(cost);
        },
      );

      it('applies a status effect and bumps updatedAt', async () => {
        const stored = await storedEquipment();
        await nextMillisecond();

        const recorded = await repository.recordEvent(
          newEvent(stored.id, { type: 'BREAKDOWN', resultingStatus: 'OUT_OF_SERVICE' }),
          { status: 'OUT_OF_SERVICE' },
        );

        expect(recorded?.event).toMatchObject({ resultingStatus: 'OUT_OF_SERVICE' });
        expect(recorded?.equipment).toEqual({
          ...stored,
          status: 'OUT_OF_SERVICE',
          updatedAt: expect.any(Date),
        });
        expect(recorded?.equipment.updatedAt.getTime()).toBeGreaterThan(stored.updatedAt.getTime());
        await expect(repository.findById(stored.id)).resolves.toEqual(recorded?.equipment);
      });

      it('applies a location effect for a transfer', async () => {
        const stored = await storedEquipment();

        const recorded = await repository.recordEvent(
          newEvent(stored.id, {
            type: 'TRANSFER',
            fromLocationId: centroId,
            toLocationId: kioscoId,
          }),
          { locationId: kioscoId },
        );

        expect(recorded?.event).toMatchObject({ fromLocationId: centroId, toLocationId: kioscoId });
        expect(recorded?.equipment).toMatchObject({ locationId: kioscoId, status: 'OPERATIONAL' });
        await expect(repository.findById(stored.id)).resolves.toEqual(recorded?.equipment);
      });

      it('stores the replacement equipment and retires the replaced one', async () => {
        const stored = await storedEquipment();
        const replacement = await storedEquipment({ name: 'Freezer nuevo' });

        const recorded = await repository.recordEvent(
          newEvent(stored.id, { type: 'REPLACEMENT', replacementEquipmentId: replacement.id }),
          { status: 'RETIRED' },
        );

        expect(recorded?.event).toMatchObject({ replacementEquipmentId: replacement.id });
        expect(recorded?.equipment).toMatchObject({ status: 'RETIRED' });
        await expect(repository.findById(replacement.id)).resolves.toEqual(replacement);
      });

      it('returns undefined for unknown equipment and stores nothing', async () => {
        const other = await storedEquipment();

        await expect(
          repository.recordEvent(newEvent(MISSING_ID), { status: 'RETIRED' }),
        ).resolves.toBeUndefined();
        await expect(repository.listEvents(MISSING_ID)).resolves.toEqual([]);
        await expect(repository.findById(other.id)).resolves.toEqual(other);
      });

      it.each(['fromLocationId', 'toLocationId'] as const)(
        'rejects an unknown %s at that field and applies no effect',
        async (field) => {
          const stored = await storedEquipment();

          const error = await rejectionOf(
            repository.recordEvent(
              newEvent(stored.id, {
                type: 'TRANSFER',
                fromLocationId: centroId,
                toLocationId: kioscoId,
                [field]: MISSING_ID,
              }),
              { status: 'IN_REPAIR', locationId: kioscoId },
            ),
          );

          expect(error).toBeInstanceOf(EquipmentEventLocationNotFoundError);
          expect(error).toMatchObject({
            locationId: MISSING_ID,
            issues: [{ path: field, message: 'Location does not exist' }],
          });
          await expect(repository.findById(stored.id)).resolves.toEqual(stored);
          await expect(repository.listEvents(stored.id)).resolves.toEqual([]);
        },
      );

      it('rejects unknown replacement equipment and applies no effect', async () => {
        const stored = await storedEquipment();

        const error = await rejectionOf(
          repository.recordEvent(
            newEvent(stored.id, { type: 'REPLACEMENT', replacementEquipmentId: MISSING_ID }),
            { status: 'RETIRED' },
          ),
        );

        expect(error).toBeInstanceOf(ReplacementEquipmentNotFoundError);
        expect(error).toMatchObject({
          equipmentId: MISSING_ID,
          issues: [{ path: 'replacementEquipmentId', message: 'Equipment does not exist' }],
        });
        await expect(repository.findById(stored.id)).resolves.toEqual(stored);
        await expect(repository.listEvents(stored.id)).resolves.toEqual([]);
      });

      it('rejects an unknown effect location and stores no event', async () => {
        const stored = await storedEquipment();

        await expect(
          repository.recordEvent(newEvent(stored.id), {
            status: 'IN_REPAIR',
            locationId: MISSING_ID,
          }),
        ).rejects.toBeInstanceOf(EquipmentLocationNotFoundError);
        await expect(repository.findById(stored.id)).resolves.toEqual(stored);
        await expect(repository.listEvents(stored.id)).resolves.toEqual([]);
      });
    });

    describe('listEvents', () => {
      it('returns an empty list for equipment without events or unknown equipment', async () => {
        const stored = await storedEquipment();

        await expect(repository.listEvents(stored.id)).resolves.toEqual([]);
        await expect(repository.listEvents(MISSING_ID)).resolves.toEqual([]);
      });

      it('lists only that equipment, newest occurredOn first, then latest recorded first', async () => {
        const stored = await storedEquipment();
        const other = await storedEquipment({ name: 'Otro' });
        // Recorded out of order; two pairs share a date and must come latest-recorded first.
        const plan = [
          ['2026-03-01', 'b'],
          ['2026-11-10', 'd'],
          ['2025-12-31', 'a'],
          ['2026-03-01', 'c'],
          ['2026-11-10', 'e'],
        ] as const;
        for (const [occurredOn, description] of plan) {
          await repository.recordEvent(newEvent(stored.id, { occurredOn, description }), {});
          await nextMillisecond();
        }
        await repository.recordEvent(newEvent(other.id, { description: 'otro' }), {});

        const listed = await repository.listEvents(stored.id);

        expect(listed.map((event) => event.description)).toEqual(['e', 'd', 'c', 'b', 'a']);
        expect(listed.every((event) => event.equipmentId === stored.id)).toBe(true);
      });
    });
  });
}
