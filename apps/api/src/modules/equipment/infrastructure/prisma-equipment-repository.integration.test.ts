import { afterAll, describe, expect, it } from 'vitest';

import { Prisma } from '../../../generated/prisma/client.js';
import {
  createTestPrismaClient,
  truncateAllTables,
} from '../../../test/integration/test-database.js';
import { PrismaLocationRepository } from '../../locations/infrastructure/prisma-location-repository.js';
import { describeEquipmentRepositoryContract } from './equipment-repository.contract.js';
import { WarrantyBeforePurchaseError } from '../domain/equipment-errors.js';
import { PrismaEquipmentRepository } from './prisma-equipment-repository.js';

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

async function emptyFixture() {
  await truncateAllTables(prisma);
  return {
    equipment: new PrismaEquipmentRepository(prisma),
    locations: new PrismaLocationRepository(prisma),
  };
}

describeEquipmentRepositoryContract('PrismaEquipmentRepository', emptyFixture);

describe('PrismaEquipmentRepository errors', () => {
  it('rethrows database errors other than the mapped ones', async () => {
    const { equipment, locations } = await emptyFixture();
    const location = await locations.create({ name: 'Centro', kind: 'OWN_STORE' });
    const stored = await equipment.create({
      code: 'EQ-0001',
      name: 'Freezer',
      type: 'FREEZER',
      brand: 'Gafa',
      model: 'HGF-350',
      purchaseDate: '2024-03-15',
      status: 'OPERATIONAL',
      locationId: location.id,
    });

    // `name` is VARCHAR(120): P2000 "value too long for the column" is rethrown as is, never read
    // as "not found", a duplicate code or a missing location.
    const error: unknown = await equipment.update(stored.id, { name: 'x'.repeat(121) }).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(error).toMatchObject({ code: 'P2000' });
    await expect(equipment.findById(stored.id)).resolves.toEqual(stored);
  });

  it('maps the database warranty check to WarrantyBeforePurchaseError, bypassing the use case', async () => {
    const { equipment, locations } = await emptyFixture();
    const location = await locations.create({ name: 'Centro', kind: 'OWN_STORE' });
    const stored = await equipment.create({
      code: 'EQ-0001',
      name: 'Freezer',
      type: 'FREEZER',
      brand: 'Gafa',
      model: 'HGF-350',
      purchaseDate: '2024-03-15',
      warrantyUntil: '2025-03-15',
      status: 'OPERATIONAL',
      locationId: location.id,
    });

    // Two racing PATCHes that each passed the use case's check against the record they read:
    // one moves the purchase date past the stored warranty, the other only the warranty. The
    // database must reject the second write, which would leave warranty before purchase.
    await equipment.update(stored.id, { purchaseDate: '2025-01-10' });
    await expect(
      equipment.update(stored.id, { warrantyUntil: '2024-12-31' }),
    ).rejects.toBeInstanceOf(WarrantyBeforePurchaseError);
    await expect(equipment.findById(stored.id)).resolves.toMatchObject({
      purchaseDate: '2025-01-10',
      warrantyUntil: '2025-03-15',
    });
  });

  it('rejects creating equipment whose warranty ends before the purchase date', async () => {
    const { equipment, locations } = await emptyFixture();
    const location = await locations.create({ name: 'Centro', kind: 'OWN_STORE' });

    await expect(
      equipment.create({
        code: 'EQ-0002',
        name: 'Vitrina',
        type: 'DISPLAY_CASE',
        brand: 'Gafa',
        model: 'V-100',
        purchaseDate: '2024-03-15',
        warrantyUntil: '2024-03-14',
        status: 'OPERATIONAL',
        locationId: location.id,
      }),
    ).rejects.toBeInstanceOf(WarrantyBeforePurchaseError);
    await expect(equipment.findAll()).resolves.toEqual([]);
  });

  it('accepts a warranty that ends on the purchase date', async () => {
    const { equipment, locations } = await emptyFixture();
    const location = await locations.create({ name: 'Centro', kind: 'OWN_STORE' });

    await expect(
      equipment.create({
        code: 'EQ-0003',
        name: 'Heladera',
        type: 'REFRIGERATOR',
        brand: 'Gafa',
        model: 'R-1',
        purchaseDate: '2024-03-15',
        warrantyUntil: '2024-03-15',
        status: 'OPERATIONAL',
        locationId: location.id,
      }),
    ).resolves.toMatchObject({ warrantyUntil: '2024-03-15' });
  });
});
