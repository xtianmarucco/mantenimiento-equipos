import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';

/**
 * Creates a Prisma client backed by the `pg` driver adapter.
 *
 * No connection is opened until the first query, so creating a client does not require a
 * running database.
 */
export function createPrismaClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}
