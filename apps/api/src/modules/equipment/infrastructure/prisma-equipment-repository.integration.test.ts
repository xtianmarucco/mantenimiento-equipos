import { afterAll, describe, expect, it } from 'vitest';

import { Prisma } from '../../../generated/prisma/client.js';
import {
  createTestPrismaClient,
  truncateAllTables,
} from '../../../test/integration/test-database.js';
import { PrismaLocationRepository } from '../../locations/infrastructure/prisma-location-repository.js';
import { describeEquipmentRepositoryContract } from './equipment-repository.contract.js';
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
});
