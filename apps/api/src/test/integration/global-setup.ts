import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { requireTestDatabaseUrl } from './test-database-url.js';

const apiRoot = fileURLToPath(new URL('../../../', import.meta.url));
const prismaBin = fileURLToPath(new URL('../../../node_modules/.bin/prisma', import.meta.url));

/**
 * Vitest global setup for `vitest.integration.config.ts`: fails the run when `DATABASE_URL` is
 * missing (never skips silently), then applies the committed migrations to the test database.
 */
export default function setup(): void {
  const databaseUrl = requireTestDatabaseUrl();
  execFileSync(prismaBin, ['migrate', 'deploy'], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}
