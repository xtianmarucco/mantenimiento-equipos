import 'dotenv/config';

import { createApp } from './app.js';
import { parseEnv } from './config/env.js';
import { PrismaEquipmentRepository } from './modules/equipment/infrastructure/prisma-equipment-repository.js';
import { PrismaLocationRepository } from './modules/locations/infrastructure/prisma-location-repository.js';
import { createPrismaClient } from './shared/infrastructure/prisma.js';

const env = parseEnv(process.env);
const prisma = createPrismaClient(env.DATABASE_URL);
const app = createApp({
  locationRepository: new PrismaLocationRepository(prisma),
  equipmentRepository: new PrismaEquipmentRepository(prisma),
});

const server = app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`Received ${signal}, shutting down`);
  server.close((err) => {
    if (err) {
      console.error(err);
      process.exitCode = 1;
    }
    prisma.$disconnect().catch((disconnectError: unknown) => {
      console.error(disconnectError);
      process.exitCode = 1;
    });
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
