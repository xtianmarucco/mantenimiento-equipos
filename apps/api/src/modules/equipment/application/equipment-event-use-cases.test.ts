import { describe, expect, it } from 'vitest';

import type { Location } from '../../locations/domain/location.js';
import { InMemoryLocationRepository } from '../../locations/infrastructure/in-memory-location-repository.js';
import type { Equipment, EquipmentStatus } from '../domain/equipment.js';
import {
  EquipmentEventLocationNotFoundError,
  EquipmentNotFoundError,
  InvalidEquipmentEventError,
  ReplacementEquipmentNotFoundError,
} from '../domain/equipment-errors.js';
import { InMemoryEquipmentRepository } from '../infrastructure/in-memory-equipment-repository.js';
import { ListEquipmentEventsUseCase } from './list-equipment-events.js';
import {
  RecordEquipmentEventUseCase,
  type RecordEquipmentEventInput,
} from './record-equipment-event.js';
import { localToday } from './today.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const CENTRO_ID = '3b0c5f3e-0000-4000-8000-000000000001';
const KIOSCO_ID = '3b0c5f3e-0000-4000-8000-000000000002';
const STORED_ID = '7c1d6a4f-0000-4000-8000-000000000001';
const OTHER_ID = '7c1d6a4f-0000-4000-8000-000000000002';
const RETIRED_ID = '7c1d6a4f-0000-4000-8000-000000000003';
const START = '2026-11-01T12:00:00.000Z';
const TODAY = '2026-11-01';

function location(id: string, name: string): Location {
  const timestamp = new Date('2026-01-01T00:00:00.000Z');
  return {
    id,
    name,
    kind: 'OWN_STORE',
    address: null,
    contactName: null,
    phone: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function equipment(overrides: Partial<Equipment> = {}): Equipment {
  const timestamp = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: STORED_ID,
    code: 'EQ-0001',
    name: 'Freezer horizontal',
    type: 'FREEZER',
    brand: 'Gafa',
    model: 'HGF-350',
    serialNumber: null,
    purchaseDate: '2024-03-15',
    warrantyUntil: null,
    status: 'OPERATIONAL',
    locationId: CENTRO_ID,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

/** A clock that advances one second per call, so timestamps are deterministic and ordered. */
function steppingClock(start = START): () => Date {
  let current = new Date(start).getTime();
  return () => {
    const now = new Date(current);
    current += 1000;
    return now;
  };
}

function setup(status: EquipmentStatus = 'OPERATIONAL') {
  const locations = new InMemoryLocationRepository({
    locations: [location(CENTRO_ID, 'Centro'), location(KIOSCO_ID, 'Kiosco')],
  });
  const repository = new InMemoryEquipmentRepository({
    locations,
    equipment: [
      equipment({ status }),
      equipment({ id: OTHER_ID, code: 'EQ-0002', name: 'Vitrina' }),
      equipment({ id: RETIRED_ID, code: 'EQ-0003', name: 'Antigua', status: 'RETIRED' }),
    ],
    now: steppingClock(),
  });
  const recordEvent = new RecordEquipmentEventUseCase(repository, locations, () => TODAY);
  return { locations, repository, recordEvent };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
}

const common = { occurredOn: '2026-10-20', description: 'Something happened' };

/** Asserts a 400-style rejection with one issue at `path`, and that nothing was stored. */
async function expectRejected(
  setupResult: ReturnType<typeof setup>,
  input: RecordEquipmentEventInput,
  path: string,
  message?: string,
): Promise<unknown> {
  const { repository, recordEvent } = setupResult;
  const before = await repository.findById(STORED_ID);

  const error = await rejection(recordEvent.execute(STORED_ID, input));

  expect(error).toMatchObject({
    issues: [{ path, ...(message === undefined ? {} : { message }) }],
  });
  await expect(repository.listEvents(STORED_ID)).resolves.toEqual([]);
  await expect(repository.findById(STORED_ID)).resolves.toEqual(before);
  return error;
}

describe('RecordEquipmentEventUseCase', () => {
  it('throws EquipmentNotFoundError for unknown equipment', async () => {
    const { recordEvent } = setup();

    await expect(
      recordEvent.execute(MISSING_ID, { ...common, type: 'MAINTENANCE' }),
    ).rejects.toThrow(new EquipmentNotFoundError(MISSING_ID));
  });

  describe('MAINTENANCE', () => {
    it('records the event without changing the equipment', async () => {
      const { repository, recordEvent } = setup();

      const result = await recordEvent.execute(STORED_ID, {
        ...common,
        type: 'MAINTENANCE',
        technician: 'Juan',
        cost: 1500.5,
      });

      expect(result.equipment).toEqual(equipment());
      expect(result.event).toEqual({
        id: expect.any(String),
        equipmentId: STORED_ID,
        type: 'MAINTENANCE',
        occurredOn: '2026-10-20',
        description: 'Something happened',
        technician: 'Juan',
        cost: 1500.5,
        resultingStatus: null,
        fromLocationId: null,
        toLocationId: null,
        replacementEquipmentId: null,
        createdAt: new Date(START),
      });
      await expect(repository.listEvents(STORED_ID)).resolves.toEqual([result.event]);
    });

    it('is allowed from any non-retired status', async () => {
      for (const status of ['IN_REPAIR', 'OUT_OF_SERVICE'] as const) {
        const { recordEvent } = setup(status);

        const result = await recordEvent.execute(STORED_ID, { ...common, type: 'MAINTENANCE' });

        expect(result.equipment.status).toBe(status);
      }
    });
  });

  describe('BREAKDOWN', () => {
    it('sets the resulting status, from every non-retired status', async () => {
      for (const from of ['OPERATIONAL', 'IN_REPAIR', 'OUT_OF_SERVICE'] as const) {
        for (const resultingStatus of ['IN_REPAIR', 'OUT_OF_SERVICE'] as const) {
          const { recordEvent } = setup(from);

          const result = await recordEvent.execute(STORED_ID, {
            ...common,
            type: 'BREAKDOWN',
            resultingStatus,
          });

          expect(result.event.resultingStatus).toBe(resultingStatus);
          expect(result.equipment).toEqual({
            ...equipment({ status: resultingStatus }),
            updatedAt: new Date(START),
          });
        }
      }
    });
  });

  describe('REPAIR', () => {
    it('sets the status to OPERATIONAL from IN_REPAIR or OUT_OF_SERVICE', async () => {
      for (const from of ['IN_REPAIR', 'OUT_OF_SERVICE'] as const) {
        const { recordEvent } = setup(from);

        const result = await recordEvent.execute(STORED_ID, {
          ...common,
          type: 'REPAIR',
          technician: 'Frío Sur',
          cost: 42000,
        });

        expect(result.equipment.status).toBe('OPERATIONAL');
        expect(result.event).toMatchObject({ type: 'REPAIR', technician: 'Frío Sur', cost: 42000 });
      }
    });

    it('rejects repairing operational equipment, with an issue at type', async () => {
      const error = await expectRejected(
        setup('OPERATIONAL'),
        { ...common, type: 'REPAIR' },
        'type',
        'Only equipment in repair or out of service can be repaired',
      );

      expect(error).toBeInstanceOf(InvalidEquipmentEventError);
    });
  });

  describe('TRANSFER', () => {
    it('moves the equipment and records where it was', async () => {
      const { recordEvent } = setup('IN_REPAIR');

      const result = await recordEvent.execute(STORED_ID, {
        ...common,
        type: 'TRANSFER',
        toLocationId: KIOSCO_ID,
      });

      expect(result.event).toMatchObject({ fromLocationId: CENTRO_ID, toLocationId: KIOSCO_ID });
      expect(result.equipment).toEqual({
        ...equipment({ status: 'IN_REPAIR', locationId: KIOSCO_ID }),
        updatedAt: new Date(START),
      });
    });

    it('rejects the current location, with an issue at toLocationId', async () => {
      await expectRejected(
        setup(),
        { ...common, type: 'TRANSFER', toLocationId: CENTRO_ID },
        'toLocationId',
        'Equipment is already at this location',
      );
    });

    it('rejects a location that does not exist, with an issue at toLocationId', async () => {
      const error = await expectRejected(
        setup(),
        { ...common, type: 'TRANSFER', toLocationId: MISSING_ID },
        'toLocationId',
        'Location does not exist',
      );

      expect(error).toBeInstanceOf(EquipmentEventLocationNotFoundError);
    });
  });

  describe('REPLACEMENT', () => {
    it('retires the equipment and records its replacement', async () => {
      const { recordEvent } = setup('OUT_OF_SERVICE');

      const result = await recordEvent.execute(STORED_ID, {
        ...common,
        type: 'REPLACEMENT',
        replacementEquipmentId: OTHER_ID,
      });

      expect(result.event.replacementEquipmentId).toBe(OTHER_ID);
      expect(result.equipment.status).toBe('RETIRED');
    });

    it('accepts a replacement without replacement equipment', async () => {
      const { recordEvent } = setup();

      const result = await recordEvent.execute(STORED_ID, { ...common, type: 'REPLACEMENT' });

      expect(result.event.replacementEquipmentId).toBeNull();
      expect(result.equipment.status).toBe('RETIRED');
    });

    it('rejects replacement equipment that does not exist', async () => {
      const error = await expectRejected(
        setup(),
        { ...common, type: 'REPLACEMENT', replacementEquipmentId: MISSING_ID },
        'replacementEquipmentId',
        'Equipment does not exist',
      );

      expect(error).toBeInstanceOf(ReplacementEquipmentNotFoundError);
    });

    it('rejects the equipment replacing itself', async () => {
      await expectRejected(
        setup(),
        { ...common, type: 'REPLACEMENT', replacementEquipmentId: STORED_ID },
        'replacementEquipmentId',
        'Equipment cannot replace itself',
      );
    });

    it('rejects retired replacement equipment', async () => {
      await expectRejected(
        setup(),
        { ...common, type: 'REPLACEMENT', replacementEquipmentId: RETIRED_ID },
        'replacementEquipmentId',
        'Replacement equipment is retired',
      );
    });
  });

  describe('RETIREMENT', () => {
    it('retires the equipment', async () => {
      const { recordEvent } = setup('IN_REPAIR');

      const result = await recordEvent.execute(STORED_ID, { ...common, type: 'RETIREMENT' });

      expect(result.equipment).toEqual({
        ...equipment({ status: 'RETIRED' }),
        updatedAt: new Date(START),
      });
    });
  });

  describe('retired equipment', () => {
    it('accepts no events, with an issue at type', async () => {
      const inputs: RecordEquipmentEventInput[] = [
        { ...common, type: 'MAINTENANCE' },
        { ...common, type: 'BREAKDOWN', resultingStatus: 'IN_REPAIR' },
        { ...common, type: 'REPAIR' },
        { ...common, type: 'TRANSFER', toLocationId: KIOSCO_ID },
        { ...common, type: 'REPLACEMENT' },
        { ...common, type: 'RETIREMENT' },
      ];
      for (const input of inputs) {
        const error = await expectRejected(
          setup('RETIRED'),
          input,
          'type',
          'Retired equipment accepts no events',
        );

        expect(error).toBeInstanceOf(InvalidEquipmentEventError);
      }
    });
  });

  describe('occurredOn', () => {
    it('accepts today and the purchase date (boundaries)', async () => {
      const { recordEvent } = setup();

      await expect(
        recordEvent.execute(STORED_ID, { ...common, type: 'MAINTENANCE', occurredOn: TODAY }),
      ).resolves.toMatchObject({ event: { occurredOn: TODAY } });
      await expect(
        recordEvent.execute(STORED_ID, {
          ...common,
          type: 'MAINTENANCE',
          occurredOn: '2024-03-15',
        }),
      ).resolves.toMatchObject({ event: { occurredOn: '2024-03-15' } });
    });

    it('rejects a date after today', async () => {
      await expectRejected(
        setup(),
        { ...common, type: 'MAINTENANCE', occurredOn: '2026-11-02' },
        'occurredOn',
        'Date cannot be in the future',
      );
    });

    it('rejects a date before the purchase date', async () => {
      await expectRejected(
        setup(),
        { ...common, type: 'RETIREMENT', occurredOn: '2024-03-14' },
        'occurredOn',
        'Date cannot be before the purchase date',
      );
    });
  });
});

describe('ListEquipmentEventsUseCase', () => {
  it('returns the history newest first', async () => {
    const { repository, recordEvent } = setup();
    const older = await recordEvent.execute(STORED_ID, {
      ...common,
      type: 'BREAKDOWN',
      resultingStatus: 'IN_REPAIR',
      occurredOn: '2026-10-01',
    });
    const newer = await recordEvent.execute(STORED_ID, {
      ...common,
      type: 'REPAIR',
      occurredOn: '2026-10-05',
    });

    const history = await new ListEquipmentEventsUseCase(repository).execute(STORED_ID);

    expect(history).toEqual([newer.event, older.event]);
  });

  it('throws EquipmentNotFoundError for unknown equipment', async () => {
    const { repository } = setup();

    await expect(new ListEquipmentEventsUseCase(repository).execute(MISSING_ID)).rejects.toThrow(
      new EquipmentNotFoundError(MISSING_ID),
    );
  });
});

describe('localToday', () => {
  it('formats the clock date in the process time zone as YYYY-MM-DD', () => {
    expect(localToday(() => new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localToday(() => new Date(2026, 10, 30, 0, 0))).toBe('2026-11-30');
  });
});
