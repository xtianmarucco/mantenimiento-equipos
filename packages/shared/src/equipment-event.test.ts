import { describe, expect, it } from 'vitest';

import {
  createEquipmentEventSchema,
  equipmentEventResponseSchema,
  equipmentEventTypeSchema,
  recordEquipmentEventResponseSchema,
  type CreateEquipmentEventInput,
  type EquipmentEventResponse,
} from './index.js';

const locationId = '0b7a4c3e-2f1d-4e5a-9b8c-7d6e5f4a3b2c';
const otherEquipmentId = '5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

const common = { occurredOn: '2026-11-10', description: 'Compressor checked' };

const validByType: Record<string, CreateEquipmentEventInput> = {
  MAINTENANCE: { ...common, type: 'MAINTENANCE', technician: 'Juan Pérez', cost: 15000.5 },
  BREAKDOWN: { ...common, type: 'BREAKDOWN', resultingStatus: 'IN_REPAIR' },
  REPAIR: { ...common, type: 'REPAIR', technician: 'Frío Sur', cost: 42000 },
  TRANSFER: { ...common, type: 'TRANSFER', toLocationId: locationId },
  REPLACEMENT: { ...common, type: 'REPLACEMENT', replacementEquipmentId: otherEquipmentId },
  RETIREMENT: { ...common, type: 'RETIREMENT' },
};

describe('equipmentEventTypeSchema', () => {
  it('lists every event type', () => {
    expect(equipmentEventTypeSchema.options).toEqual([
      'MAINTENANCE',
      'BREAKDOWN',
      'REPAIR',
      'TRANSFER',
      'REPLACEMENT',
      'RETIREMENT',
    ]);
  });
});

describe('createEquipmentEventSchema', () => {
  it.each(Object.entries(validByType))('accepts a valid %s event', (_type, payload) => {
    expect(createEquipmentEventSchema.safeParse(payload).success).toBe(true);
  });

  it('accepts maintenance and repair without technician or cost, or with them null', () => {
    for (const type of ['MAINTENANCE', 'REPAIR'] as const) {
      expect(createEquipmentEventSchema.safeParse({ ...common, type }).success).toBe(true);
      expect(
        createEquipmentEventSchema.safeParse({ ...common, type, technician: null, cost: null })
          .success,
      ).toBe(true);
    }
  });

  it('accepts a replacement without replacement equipment, or with it null', () => {
    expect(createEquipmentEventSchema.safeParse({ ...common, type: 'REPLACEMENT' }).success).toBe(
      true,
    );
    expect(
      createEquipmentEventSchema.safeParse({
        ...common,
        type: 'REPLACEMENT',
        replacementEquipmentId: null,
      }).success,
    ).toBe(true);
  });

  it('trims the description and the technician', () => {
    const result = createEquipmentEventSchema.parse({
      ...common,
      type: 'MAINTENANCE',
      description: '  Cleaned condenser  ',
      technician: '  Juan  ',
    });

    expect(result).toMatchObject({ description: 'Cleaned condenser', technician: 'Juan' });
  });

  it('requires a valid occurredOn date', () => {
    const { occurredOn: _omit, ...withoutDate } = validByType.RETIREMENT!;
    expect(createEquipmentEventSchema.safeParse(withoutDate).success).toBe(false);

    for (const occurredOn of ['2026-02-30', '10/11/2026', '2026-11-10T10:00:00Z']) {
      const result = createEquipmentEventSchema.safeParse({
        ...validByType.RETIREMENT,
        occurredOn,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(['occurredOn']);
    }
  });

  it('requires a non-blank description of at most 1000 characters', () => {
    const { description: _omit, ...withoutDescription } = validByType.RETIREMENT!;
    expect(createEquipmentEventSchema.safeParse(withoutDescription).success).toBe(false);

    for (const description of ['   ', 'x'.repeat(1001)]) {
      const result = createEquipmentEventSchema.safeParse({
        ...validByType.RETIREMENT,
        description,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(['description']);
    }
  });

  it('accepts a description of exactly 1000 characters', () => {
    const description = 'x'.repeat(1000);

    const result = createEquipmentEventSchema.safeParse({ ...validByType.RETIREMENT, description });

    expect(result.success).toBe(true);
    expect(result.data?.description).toBe(description);
  });

  it('rejects an unknown or missing type', () => {
    expect(createEquipmentEventSchema.safeParse({ ...common, type: 'INSPECTION' }).success).toBe(
      false,
    );
    expect(createEquipmentEventSchema.safeParse(common).success).toBe(false);
  });

  it('requires a breakdown to leave the equipment in repair or out of service', () => {
    for (const resultingStatus of ['IN_REPAIR', 'OUT_OF_SERVICE']) {
      expect(
        createEquipmentEventSchema.safeParse({ ...common, type: 'BREAKDOWN', resultingStatus })
          .success,
      ).toBe(true);
    }

    for (const resultingStatus of ['OPERATIONAL', 'RETIRED', undefined]) {
      const result = createEquipmentEventSchema.safeParse({
        ...common,
        type: 'BREAKDOWN',
        resultingStatus,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(['resultingStatus']);
    }
  });

  it('requires a transfer destination that is a UUID', () => {
    for (const toLocationId of ['store-1', undefined, null]) {
      const result = createEquipmentEventSchema.safeParse({
        ...common,
        type: 'TRANSFER',
        toLocationId,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(['toLocationId']);
    }
  });

  it('rejects a replacement equipment id that is not a UUID', () => {
    const result = createEquipmentEventSchema.safeParse({
      ...common,
      type: 'REPLACEMENT',
      replacementEquipmentId: 'EQ-0042',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['replacementEquipmentId']);
  });

  it('accepts a cost of zero and costs with up to two decimals', () => {
    for (const cost of [0, 0.01, 19.99, 1234.56, 99_999_999.99]) {
      expect(
        createEquipmentEventSchema.safeParse({ ...common, type: 'REPAIR', cost }).success,
      ).toBe(true);
    }
  });

  it('rejects a negative cost, more than two decimals, too large or non-numeric costs', () => {
    for (const cost of [-1, -0.01, 10.555, 0.001, 100_000_000, Number.NaN, '100']) {
      const result = createEquipmentEventSchema.safeParse({ ...common, type: 'MAINTENANCE', cost });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(['cost']);
    }
  });

  it('rejects a technician longer than 120 characters', () => {
    const result = createEquipmentEventSchema.safeParse({
      ...common,
      type: 'REPAIR',
      technician: 'x'.repeat(121),
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['technician']);
  });

  it('accepts a technician of exactly 120 characters', () => {
    const technician = 'x'.repeat(120);

    const result = createEquipmentEventSchema.safeParse({ ...common, type: 'REPAIR', technician });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ technician });
  });

  it('drops fields that do not belong to the event type', () => {
    const result = createEquipmentEventSchema.parse({
      ...common,
      type: 'RETIREMENT',
      cost: 100,
      toLocationId: locationId,
    });

    expect(result).toEqual({ ...common, type: 'RETIREMENT' });
  });
});

describe('equipmentEventResponseSchema', () => {
  const row: EquipmentEventResponse = {
    id: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a',
    equipmentId: otherEquipmentId,
    type: 'TRANSFER',
    occurredOn: '2026-11-10',
    description: 'Moved to the kiosk',
    technician: null,
    cost: null,
    resultingStatus: null,
    fromLocationId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    toLocationId: locationId,
    replacementEquipmentId: null,
    createdAt: '2026-11-10T12:00:00.000Z',
  };

  it('accepts a full row with nulls for fields that do not apply', () => {
    expect(equipmentEventResponseSchema.parse(row)).toEqual(row);
  });

  it('accepts a row with every type-specific field set', () => {
    const full = {
      ...row,
      type: 'BREAKDOWN',
      technician: 'Juan',
      cost: 1500.25,
      resultingStatus: 'OUT_OF_SERVICE',
      replacementEquipmentId: otherEquipmentId,
    };

    expect(equipmentEventResponseSchema.safeParse(full).success).toBe(true);
  });

  it('rejects a row with a missing field or an invalid createdAt', () => {
    const { technician: _omit, ...withoutTechnician } = row;
    expect(equipmentEventResponseSchema.safeParse(withoutTechnician).success).toBe(false);
    expect(
      equipmentEventResponseSchema.safeParse({ ...row, createdAt: '2026-11-10' }).success,
    ).toBe(false);
  });
});

describe('recordEquipmentEventResponseSchema', () => {
  const event: EquipmentEventResponse = {
    id: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a',
    equipmentId: otherEquipmentId,
    type: 'RETIREMENT',
    occurredOn: '2026-11-10',
    description: 'No longer worth repairing',
    technician: null,
    cost: null,
    resultingStatus: null,
    fromLocationId: null,
    toLocationId: null,
    replacementEquipmentId: null,
    createdAt: '2026-11-10T12:00:00.000Z',
  };
  const equipment = {
    id: otherEquipmentId,
    code: 'EQ-0001',
    name: 'Freezer',
    type: 'FREEZER',
    brand: 'Gafa',
    model: 'HGF-350',
    serialNumber: null,
    purchaseDate: '2024-03-15',
    warrantyUntil: null,
    status: 'RETIRED',
    locationId,
    notes: null,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-11-10T12:00:00.000Z',
  };

  it('accepts the recorded event with its equipment after the effect', () => {
    expect(recordEquipmentEventResponseSchema.parse({ event, equipment })).toEqual({
      event,
      equipment,
    });
  });

  it('rejects a response missing the equipment or with an invalid event', () => {
    expect(recordEquipmentEventResponseSchema.safeParse({ event }).success).toBe(false);
    expect(
      recordEquipmentEventResponseSchema.safeParse({ event: { ...event, type: 'X' }, equipment })
        .success,
    ).toBe(false);
  });
});
