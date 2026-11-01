import { fileURLToPath } from 'node:url';

import { configDefaults, defineConfig } from 'vitest/config';

/** Mirror the tsconfig `paths` mapping: run tests against the shared package's source. */
export const resolveSharedFromSource = {
  alias: {
    '@mantenimiento/shared': fileURLToPath(
      new URL('../../packages/shared/src/index.ts', import.meta.url),
    ),
  },
};

export default defineConfig({
  resolve: resolveSharedFromSource,
  test: {
    environment: 'node',
    // Integration tests need PostgreSQL and run through `vitest.integration.config.ts`.
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
  },
});
