import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Run by `prisma db seed` (and `prisma migrate reset`). Development only: tsx is a dev dependency.
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Optional for `prisma generate` (no database needed); required by migrate commands.
    url: process.env['DATABASE_URL'] ?? '',
  },
});
