import { describe, expect, it } from 'vitest';

import {
  createLocationSchema,
  locationKindSchema,
  locationResponseSchema,
  updateLocationSchema,
  type CreateLocationInput,
  type LocationResponse,
} from './index.js';

const validCreate: CreateLocationInput = {
  name: 'Heladería Centro',
  kind: 'OWN_STORE',
  address: 'Av. San Martín 123',
  contactName: 'Ana Pérez',
  phone: '+54 11 5555-0101',
};

describe('locationKindSchema', () => {
  it('accepts own stores and third-party kiosks', () => {
    expect(locationKindSchema.options).toEqual(['OWN_STORE', 'THIRD_PARTY']);
  });

  it('rejects unknown kinds', () => {
    expect(locationKindSchema.safeParse('WAREHOUSE').success).toBe(false);
  });
});

describe('createLocationSchema', () => {
  it('accepts a complete location', () => {
    expect(createLocationSchema.parse(validCreate)).toEqual(validCreate);
  });

  it('accepts a location with only the required fields', () => {
    const minimal = { name: 'Kiosco Plaza', kind: 'THIRD_PARTY' };

    expect(createLocationSchema.parse(minimal)).toEqual(minimal);
  });

  it('accepts null for optional fields so they can be left empty', () => {
    const result = createLocationSchema.safeParse({ ...validCreate, address: null, phone: null });

    expect(result.success).toBe(true);
  });

  it('trims the name and rejects a blank one', () => {
    expect(createLocationSchema.parse({ ...validCreate, name: '  Centro  ' }).name).toBe('Centro');
    expect(createLocationSchema.safeParse({ ...validCreate, name: '   ' }).success).toBe(false);
  });

  it('rejects a missing kind', () => {
    const { kind: _kind, ...withoutKind } = validCreate;

    expect(createLocationSchema.safeParse(withoutKind).success).toBe(false);
  });

  it('rejects a phone with letters', () => {
    expect(createLocationSchema.safeParse({ ...validCreate, phone: 'call me' }).success).toBe(
      false,
    );
  });

  // The phone column is VARCHAR(20): the limit counts every character, including a leading `+`.
  const phone = (value: string) => createLocationSchema.safeParse({ ...validCreate, phone: value });

  it('accepts a phone of exactly 20 characters, with or without a leading +', () => {
    expect(phone('1'.repeat(20)).success).toBe(true);
    expect(phone(`+${'1'.repeat(19)}`).success).toBe(true);
  });

  it('rejects a phone of 21 characters, with or without a leading +', () => {
    expect(phone('1'.repeat(21)).success).toBe(false);
    expect(phone(`+${'1'.repeat(20)}`).success).toBe(false);
  });

  it('accepts a phone of exactly 6 characters and rejects 5', () => {
    expect(phone('123456').success).toBe(true);
    expect(phone('12345').success).toBe(false);
  });

  it('counts the length after trimming surrounding whitespace', () => {
    const result = phone(`  ${'1'.repeat(20)}  `);

    expect(result.success).toBe(true);
    expect(result.data?.phone).toBe('1'.repeat(20));
  });

  it('rejects a + that is not the first character', () => {
    expect(phone('011+4444-0000').success).toBe(false);
  });
});

describe('updateLocationSchema', () => {
  it('accepts a partial update', () => {
    expect(updateLocationSchema.parse({ phone: '011 4444-0000' })).toEqual({
      phone: '011 4444-0000',
    });
  });

  it('accepts null to clear an optional field', () => {
    expect(updateLocationSchema.parse({ address: null })).toEqual({ address: null });
  });

  it('rejects an empty update', () => {
    expect(updateLocationSchema.safeParse({}).success).toBe(false);
  });

  it('still validates the fields it receives', () => {
    expect(updateLocationSchema.safeParse({ kind: 'WAREHOUSE' }).success).toBe(false);
  });
});

describe('locationResponseSchema', () => {
  const response: LocationResponse = {
    id: '0b7a4c3e-2f1d-4e5a-9b8c-7d6e5f4a3b2c',
    name: 'Kiosco Plaza',
    kind: 'THIRD_PARTY',
    address: null,
    contactName: null,
    phone: null,
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-01T12:00:00.000Z',
  };

  it('accepts a location with ISO timestamps and null optional fields', () => {
    expect(locationResponseSchema.parse(response)).toEqual(response);
  });

  it('rejects a non-ISO timestamp', () => {
    expect(locationResponseSchema.safeParse({ ...response, createdAt: 'yesterday' }).success).toBe(
      false,
    );
  });

  it('rejects an id that is not a UUID', () => {
    expect(locationResponseSchema.safeParse({ ...response, id: '42' }).success).toBe(false);
  });
});
