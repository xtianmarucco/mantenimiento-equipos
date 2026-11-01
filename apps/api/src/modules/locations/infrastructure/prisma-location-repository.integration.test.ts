import { afterAll, describe, expect, it } from 'vitest';

import { Prisma } from '../../../generated/prisma/client.js';
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
    // P2000: "value too long for the column", rethrown as is (not mapped to `undefined`).
    const error: unknown = await repository.update(stored.id, { name: 'x'.repeat(121) }).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(error).toMatchObject({ code: 'P2000' });
    await expect(repository.findById(stored.id)).resolves.toMatchObject({ name: 'Centro' });
  });
});
