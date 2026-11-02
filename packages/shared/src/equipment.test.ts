import { describe, expect, it } from 'vitest';

import {
  createEquipmentSchema,
  equipmentCodeSchema,
  equipmentListQuerySchema,
  equipmentResponseSchema,
  equipmentStatusSchema,
  equipmentTypeSchema,
  isoDateSchema,
  updateEquipmentSchema,
  type CreateEquipmentInput,
  type EquipmentResponse,
} from './index.js';

const locationId = '0b7a4c3e-2f1d-4e5a-9b8c-7d6e5f4a3b2c';

const validCreate: CreateEquipmentInput = {
  code: 'EQ-0042',
  name: 'Freezer horizontal 1',
  type: 'FREEZER',
  brand: 'Gafa',
  model: 'FH-300',
  serialNumber: 'SN-123456',
  purchaseDate: '2025-03-15',
  warrantyUntil: '2026-03-15',
  status: 'OPERATIONAL',
  locationId,
  notes: 'Front-left of the store',
};

describe('equipment enums', () => {
  it('lists every status', () => {
    expect(equipmentStatusSchema.options).toEqual([
      'OPERATIONAL',
      'IN_REPAIR',
      'OUT_OF_SERVICE',
      'RETIRED',
    ]);
  });

  it('lists every type', () => {
    expect(equipmentTypeSchema.options).toEqual([
      'FREEZER',
      'REFRIGERATOR',
      'DISPLAY_CASE',
      'ICE_CREAM_MACHINE',
      'OTHER',
    ]);
  });
});

describe('equipmentCodeSchema', () => {
  it('accepts a prefix of 2 to 4 letters, a dash and 4 digits', () => {
    for (const code of ['EQ-0042', 'FRZ-0001', 'ABCD-9999']) {
      expect(equipmentCodeSchema.parse(code)).toBe(code);
    }
  });

  it('trims and uppercases before validating', () => {
    expect(equipmentCodeSchema.parse('  eq-0042 ')).toBe('EQ-0042');
  });

  it.each(['EQ42', 'EQ-42', 'EQ-00420', 'E-0042', 'ABCDE-0042', 'EQ_0042', 'EQ-00A2', ''])(
    'rejects %j',
    (code) => {
      expect(equipmentCodeSchema.safeParse(code).success).toBe(false);
    },
  );
});

describe('isoDateSchema', () => {
  it('accepts a calendar date', () => {
    expect(isoDateSchema.parse('2025-03-15')).toBe('2025-03-15');
  });

  it.each(['2025-3-15', '15/03/2025', '2025-02-30', '2025-03-15T00:00:00Z'])(
    'rejects %j',
    (value) => {
      expect(isoDateSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe('createEquipmentSchema', () => {
  it('accepts a complete equipment item', () => {
    expect(createEquipmentSchema.parse(validCreate)).toEqual(validCreate);
  });

  it('normalizes the code', () => {
    expect(createEquipmentSchema.parse({ ...validCreate, code: ' eq-0042' }).code).toBe('EQ-0042');
  });

  it('defaults the status to OPERATIONAL', () => {
    const { status: _status, ...withoutStatus } = validCreate;

    expect(createEquipmentSchema.parse(withoutStatus).status).toBe('OPERATIONAL');
  });

  it('accepts missing or null optional fields', () => {
    const { serialNumber: _s, warrantyUntil: _w, notes: _n, ...required } = validCreate;

    expect(createEquipmentSchema.safeParse(required).success).toBe(true);
    expect(
      createEquipmentSchema.safeParse({ ...required, serialNumber: null, notes: null }).success,
    ).toBe(true);
  });

  it('requires a purchase date', () => {
    const { purchaseDate: _p, ...withoutPurchaseDate } = validCreate;

    expect(createEquipmentSchema.safeParse(withoutPurchaseDate).success).toBe(false);
  });

  it('accepts a warranty ending on the purchase date', () => {
    const sameDay = { ...validCreate, warrantyUntil: validCreate.purchaseDate };

    expect(createEquipmentSchema.safeParse(sameDay).success).toBe(true);
  });

  it('rejects a warranty that ends before the purchase date, on warrantyUntil', () => {
    const result = createEquipmentSchema.safeParse({ ...validCreate, warrantyUntil: '2025-03-14' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['warrantyUntil']);
  });

  it('rejects an unknown type or status', () => {
    expect(createEquipmentSchema.safeParse({ ...validCreate, type: 'OVEN' }).success).toBe(false);
    expect(createEquipmentSchema.safeParse({ ...validCreate, status: 'LOST' }).success).toBe(false);
  });

  it('rejects a location id that is not a UUID', () => {
    expect(createEquipmentSchema.safeParse({ ...validCreate, locationId: 'store-1' }).success).toBe(
      false,
    );
  });
});

describe('updateEquipmentSchema', () => {
  it('accepts a partial update', () => {
    expect(updateEquipmentSchema.parse({ status: 'IN_REPAIR' })).toEqual({ status: 'IN_REPAIR' });
  });

  it('does not apply the create default for status', () => {
    expect(updateEquipmentSchema.parse({ name: 'Freezer 2' })).toEqual({ name: 'Freezer 2' });
  });

  it('accepts null to clear the warranty', () => {
    expect(updateEquipmentSchema.parse({ warrantyUntil: null })).toEqual({ warrantyUntil: null });
  });

  it('rejects an empty update', () => {
    expect(updateEquipmentSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a warranty before the purchase date when both are given', () => {
    const result = updateEquipmentSchema.safeParse({
      purchaseDate: '2025-03-15',
      warrantyUntil: '2024-12-31',
    });

    expect(result.success).toBe(false);
  });
});

describe('equipmentResponseSchema', () => {
  const response: EquipmentResponse = {
    id: '9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f',
    code: 'EQ-0042',
    name: 'Freezer horizontal 1',
    type: 'FREEZER',
    brand: 'Gafa',
    model: 'FH-300',
    serialNumber: null,
    purchaseDate: '2025-03-15',
    warrantyUntil: null,
    status: 'RETIRED',
    locationId,
    notes: null,
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-01T12:30:00.000Z',
  };

  it('accepts an equipment item with ISO dates', () => {
    expect(equipmentResponseSchema.parse(response)).toEqual(response);
  });

  it('rejects a purchase date sent as a timestamp', () => {
    const result = equipmentResponseSchema.safeParse({
      ...response,
      purchaseDate: '2025-03-15T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
  });
});

describe('equipmentListQuerySchema', () => {
  it('accepts no filters', () => {
    expect(equipmentListQuerySchema.parse({})).toEqual({});
  });

  it('accepts status, location and type filters', () => {
    const query = { status: 'IN_REPAIR', locationId, type: 'DISPLAY_CASE' };

    expect(equipmentListQuerySchema.parse(query)).toEqual(query);
  });

  it('rejects invalid filter values', () => {
    expect(equipmentListQuerySchema.safeParse({ status: 'BROKEN' }).success).toBe(false);
    expect(equipmentListQuerySchema.safeParse({ locationId: 'x' }).success).toBe(false);
  });
});
