import { describe, expect, it } from 'vitest';

import type { Location } from '../../locations/domain/location.js';
import { InMemoryLocationRepository } from '../../locations/infrastructure/in-memory-location-repository.js';
import type { Equipment, EquipmentDetailChanges, NewEquipment } from '../domain/equipment.js';
import {
  EquipmentLocationNotFoundError,
  EquipmentNotFoundError,
  WarrantyBeforePurchaseError,
} from '../domain/equipment-errors.js';
import { InMemoryEquipmentRepository } from '../infrastructure/in-memory-equipment-repository.js';
import { CreateEquipmentUseCase } from './create-equipment.js';
import { GetEquipmentUseCase } from './get-equipment.js';
import { ListEquipmentUseCase } from './list-equipment.js';
import { UpdateEquipmentUseCase } from './update-equipment.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const CENTRO_ID = '3b0c5f3e-0000-4000-8000-000000000001';
const KIOSCO_ID = '3b0c5f3e-0000-4000-8000-000000000002';
const STORED_ID = '7c1d6a4f-0000-4000-8000-000000000001';
const START = '2026-11-01T12:00:00.000Z';

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
    warrantyUntil: '2025-03-15',
    status: 'OPERATIONAL',
    locationId: CENTRO_ID,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

const newEquipment: NewEquipment = {
  code: 'EQ-0042',
  name: 'Vitrina',
  type: 'DISPLAY_CASE',
  brand: 'Inelro',
  model: 'VH-150',
  purchaseDate: '2025-06-01',
  status: 'OPERATIONAL',
  locationId: KIOSCO_ID,
};

/** A clock that advances one second per call, so timestamps are deterministic and ordered. */
function steppingClock(start = START): () => Date {
  let current = new Date(start).getTime();
  return () => {
    const now = new Date(current);
    current += 1000;
    return now;
  };
}

function setup(stored: readonly Equipment[] = [equipment()]) {
  const locations = new InMemoryLocationRepository({
    locations: [location(CENTRO_ID, 'Centro'), location(KIOSCO_ID, 'Kiosco')],
  });
  const repository = new InMemoryEquipmentRepository({
    locations,
    equipment: stored,
    now: steppingClock(),
  });
  return { locations, repository };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
}

describe('ListEquipmentUseCase', () => {
  it('passes the filter to the repository, leaving retired equipment out by default', async () => {
    const { repository } = setup([
      equipment({ id: '7c1d6a4f-0000-4000-8000-000000000001', name: 'Vitrina' }),
      equipment({ id: '7c1d6a4f-0000-4000-8000-000000000002', name: 'Árbol', code: 'EQ-0002' }),
      equipment({
        id: '7c1d6a4f-0000-4000-8000-000000000003',
        name: 'Retirado',
        code: 'EQ-0003',
        status: 'RETIRED',
      }),
    ]);
    const listEquipment = new ListEquipmentUseCase(repository);

    const active = await listEquipment.execute();
    const retired = await listEquipment.execute({ status: 'RETIRED' });

    expect(active.map((item) => item.name)).toEqual(['Árbol', 'Vitrina']);
    expect(retired.map((item) => item.name)).toEqual(['Retirado']);
  });
});

describe('GetEquipmentUseCase', () => {
  it('returns the equipment with the given id', async () => {
    const { repository } = setup();

    await expect(new GetEquipmentUseCase(repository).execute(STORED_ID)).resolves.toEqual(
      equipment(),
    );
  });

  it('throws EquipmentNotFoundError for an unknown id', async () => {
    const { repository } = setup();

    await expect(new GetEquipmentUseCase(repository).execute(MISSING_ID)).rejects.toThrow(
      new EquipmentNotFoundError(MISSING_ID),
    );
  });
});

describe('CreateEquipmentUseCase', () => {
  it('stores new equipment at an existing location', async () => {
    const { repository, locations } = setup([]);

    const created = await new CreateEquipmentUseCase(repository, locations).execute(newEquipment);

    expect(created).toEqual({
      ...newEquipment,
      id: expect.any(String),
      serialNumber: null,
      warrantyUntil: null,
      notes: null,
      createdAt: new Date(START),
      updatedAt: new Date(START),
    });
    await expect(repository.findById(created.id)).resolves.toEqual(created);
  });

  it('rejects a location that does not exist, with an issue at locationId', async () => {
    const { repository, locations } = setup([]);

    const error = await rejection(
      new CreateEquipmentUseCase(repository, locations).execute({
        ...newEquipment,
        locationId: MISSING_ID,
      }),
    );

    expect(error).toBeInstanceOf(EquipmentLocationNotFoundError);
    expect(error).toMatchObject({
      issues: [{ path: 'locationId', message: 'Location does not exist' }],
    });
    await expect(repository.findAll()).resolves.toEqual([]);
  });
});

describe('UpdateEquipmentUseCase', () => {
  it('changes the given fields and bumps updatedAt', async () => {
    const { repository } = setup();

    const updated = await new UpdateEquipmentUseCase(repository).execute(STORED_ID, {
      name: 'Freezer vertical',
      notes: 'En préstamo',
    });

    expect(updated).toEqual({
      ...equipment(),
      name: 'Freezer vertical',
      notes: 'En préstamo',
      updatedAt: new Date(START),
    });
  });

  it('never applies a status or location: they change only through events', async () => {
    const { repository } = setup();
    // Not reachable through the HTTP schema, which rejects both keys; this guards the use case.
    const smuggled = {
      notes: 'En préstamo',
      status: 'RETIRED',
      locationId: KIOSCO_ID,
    } as unknown as EquipmentDetailChanges;

    const updated = await new UpdateEquipmentUseCase(repository).execute(STORED_ID, smuggled);

    expect(updated).toEqual({ ...equipment(), notes: 'En préstamo', updatedAt: new Date(START) });
  });

  it('throws EquipmentNotFoundError for an unknown id', async () => {
    const { repository } = setup();

    await expect(
      new UpdateEquipmentUseCase(repository).execute(MISSING_ID, { name: 'Nuevo' }),
    ).rejects.toBeInstanceOf(EquipmentNotFoundError);
  });

  describe('warranty rule against the stored record', () => {
    // Stored: purchased 2024-03-15, warranty until 2025-03-15.
    it('rejects a warranty end before the stored purchase date', async () => {
      const { repository } = setup();

      const error = await rejection(
        new UpdateEquipmentUseCase(repository).execute(STORED_ID, {
          warrantyUntil: '2024-03-14',
        }),
      );

      expect(error).toBeInstanceOf(WarrantyBeforePurchaseError);
      expect(error).toMatchObject({ issues: [{ path: 'warrantyUntil' }] });
      await expect(repository.findById(STORED_ID)).resolves.toEqual(equipment());
    });

    it('rejects a purchase date after the stored warranty end, with an issue at warrantyUntil', async () => {
      const { repository } = setup();

      const error = await rejection(
        new UpdateEquipmentUseCase(repository).execute(STORED_ID, {
          purchaseDate: '2025-03-16',
        }),
      );

      expect(error).toBeInstanceOf(WarrantyBeforePurchaseError);
      expect(error).toMatchObject({ issues: [{ path: 'warrantyUntil' }] });
    });

    it('accepts dates on the boundary and either date alone when consistent', async () => {
      const { repository } = setup();
      const updateEquipment = new UpdateEquipmentUseCase(repository);

      await expect(
        updateEquipment.execute(STORED_ID, { warrantyUntil: '2024-03-15' }),
      ).resolves.toMatchObject({ purchaseDate: '2024-03-15', warrantyUntil: '2024-03-15' });
      await expect(
        updateEquipment.execute(STORED_ID, { purchaseDate: '2024-03-15' }),
      ).resolves.toMatchObject({ purchaseDate: '2024-03-15', warrantyUntil: '2024-03-15' });
    });

    it('accepts any purchase date when the stored warranty is empty or cleared', async () => {
      const { repository } = setup([equipment({ warrantyUntil: null })]);
      const updateEquipment = new UpdateEquipmentUseCase(repository);

      await expect(
        updateEquipment.execute(STORED_ID, { purchaseDate: '2030-01-01' }),
      ).resolves.toMatchObject({ purchaseDate: '2030-01-01', warrantyUntil: null });

      const { repository: other } = setup();
      await expect(
        new UpdateEquipmentUseCase(other).execute(STORED_ID, {
          purchaseDate: '2030-01-01',
          warrantyUntil: null,
        }),
      ).resolves.toMatchObject({ purchaseDate: '2030-01-01', warrantyUntil: null });
    });
  });
});
