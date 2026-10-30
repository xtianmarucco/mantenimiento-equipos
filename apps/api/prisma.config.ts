import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Optional for `prisma generate` (no database needed); required by migrate commands.
    url: process.env['DATABASE_URL'] ?? '',
  },
});
