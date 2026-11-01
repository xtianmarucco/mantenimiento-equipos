import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { requireTestDatabaseUrl } from './test-database-url.js';

const apiRoot = fileURLToPath(new URL('../../../', import.meta.url));
const prismaBin = fileURLToPath(new URL('../../../node_modules/.bin/prisma', import.meta.url));

/**
 * Vitest global setup for `vitest.integration.config.ts`: applies the committed migrations to the
 * test database. The config already rejected a missing or non-test `DATABASE_URL` while loading;
 * the check here is a defensive repeat so `prisma migrate deploy` never runs against another
 * database if this setup is reused elsewhere.
 */
export default function setup(): void {
  const databaseUrl = requireTestDatabaseUrl();
  execFileSync(prismaBin, ['migrate', 'deploy'], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}
