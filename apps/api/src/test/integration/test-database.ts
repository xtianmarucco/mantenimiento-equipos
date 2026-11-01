import type { PrismaClient } from '../../generated/prisma/client.js';
import { createPrismaClient } from '../../shared/infrastructure/prisma.js';
import { requireTestDatabaseUrl } from './test-database-url.js';

/** A Prisma client for the integration test database (`DATABASE_URL`, name ending in `_test`). */
export function createTestPrismaClient(): PrismaClient {
  return createPrismaClient(requireTestDatabaseUrl());
}

/**
 * Empties every application table (everything in the current schema except Prisma's migration
 * history) in one statement, so foreign keys need no particular order. Call it in `beforeEach`.
 */
export async function truncateAllTables(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) {
    return;
  }
  const list = tables.map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
