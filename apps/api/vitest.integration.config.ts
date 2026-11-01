import { defineConfig } from 'vitest/config';

import { requireTestDatabaseUrl } from './src/test/integration/test-database-url.js';
import { resolveSharedFromSource } from './vitest.config.js';

// Checked while loading the config so a missing or non-test DATABASE_URL fails the run with a
// readable message before any test starts (never a silent skip).
requireTestDatabaseUrl();

/**
 * Integration tests (`*.integration.test.ts`) against a real PostgreSQL database. Run with
 * `pnpm test:integration`; `DATABASE_URL` must point at a disposable database whose name ends in
 * `_test`. The global setup fails the run when it is missing and applies the migrations.
 */
export default defineConfig({
  // Same module resolution as the unit suite (shared package from source).
  resolve: resolveSharedFromSource,
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    globalSetup: ['src/test/integration/global-setup.ts'],
    // One database for every file: run files one at a time; each test truncates in beforeEach.
    fileParallelism: false,
  },
});
