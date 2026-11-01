import { afterAll, describe, expect, it } from 'vitest';

import {
  createTestPrismaClient,
  truncateAllTables,
} from '../../../test/integration/test-database.js';
import { describeLocationRepositoryContract } from './location-repository.contract.js';
import { PrismaLocationRepository } from './prisma-location-repository.js';

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

async function emptyRepository(): Promise<PrismaLocationRepository> {
  await truncateAllTables(prisma);
  return new PrismaLocationRepository(prisma);
}

describeLocationRepositoryContract('PrismaLocationRepository', emptyRepository);

describe('PrismaLocationRepository errors', () => {
  it('rethrows database errors other than "record not found"', async () => {
    const repository = await emptyRepository();
    const stored = await repository.create({ name: 'Centro', kind: 'OWN_STORE' });

    // `name` is VARCHAR(120): the database rejects the value, which must not read as "not found".
    await expect(repository.update(stored.id, { name: 'x'.repeat(121) })).rejects.toThrow();
    await expect(repository.findById(stored.id)).resolves.toMatchObject({ name: 'Centro' });
  });
});
