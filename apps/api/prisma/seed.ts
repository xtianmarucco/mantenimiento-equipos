// Development seed: two own stores, two third-party kiosks and equipment in every status.
// Run with `pnpm --filter @mantenimiento/api db:seed` (Prisma runs the `migrations.seed` command
// from `prisma.config.ts`). Idempotent: locations are upserted by a fixed id and equipment by
// code, so running it again restores the sample values instead of duplicating rows. Every column
// is listed (absent values as explicit `null`), so the upsert `update` also clears edits made to
// fields a sample leaves empty.
import 'dotenv/config';

import { parseEnv } from '../src/config/env.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import { createPrismaClient } from '../src/shared/infrastructure/prisma.js';

const LOCATION_IDS = {
  centro: '6f1c1d2e-0a51-4b8e-9a4d-1c2b3a4d5e01',
  norte: '6f1c1d2e-0a51-4b8e-9a4d-1c2b3a4d5e02',
  kioscoPlaza: '6f1c1d2e-0a51-4b8e-9a4d-1c2b3a4d5e03',
  kioscoEstacion: '6f1c1d2e-0a51-4b8e-9a4d-1c2b3a4d5e04',
} as const;

// `Required` makes every writable column mandatory, so a sample cannot silently omit one.
type SeedLocation = Required<
  Omit<
    Prisma.LocationUncheckedCreateInput,
    'createdAt' | 'updatedAt' | 'equipment' | 'eventsFrom' | 'eventsTo'
  >
>;
type SeedEquipment = Required<
  Omit<
    Prisma.EquipmentUncheckedCreateInput,
    'id' | 'createdAt' | 'updatedAt' | 'events' | 'replacementEvents'
  >
>;

const locations: SeedLocation[] = [
  {
    id: LOCATION_IDS.centro,
    name: 'Heladería Centro',
    kind: 'OWN_STORE',
    address: 'Av. San Martín 123',
    contactName: 'Ana Pérez',
    phone: '+54 11 5555-0101',
  },
  {
    id: LOCATION_IDS.norte,
    name: 'Heladería Norte',
    kind: 'OWN_STORE',
    address: 'Belgrano 450',
    contactName: null,
    phone: null,
  },
  {
    id: LOCATION_IDS.kioscoPlaza,
    name: 'Kiosco La Plaza',
    kind: 'THIRD_PARTY',
    address: 'Plaza Mitre, local 3',
    contactName: 'Jorge Gómez',
    phone: '011 4444-0202',
  },
  {
    id: LOCATION_IDS.kioscoEstacion,
    name: 'Kiosco Estación',
    kind: 'THIRD_PARTY',
    address: null,
    contactName: 'Lucía Díaz',
    phone: '011 4444-0303',
  },
];

const date = (isoDate: string): Date => new Date(`${isoDate}T00:00:00.000Z`);

const equipment: SeedEquipment[] = [
  {
    code: 'EQ-0001',
    name: 'Vitrina heladera 12 gustos',
    type: 'DISPLAY_CASE',
    brand: 'Frigo',
    model: 'VH-12',
    serialNumber: 'FR-VH12-0001',
    purchaseDate: date('2023-09-01'),
    warrantyUntil: date('2025-09-01'),
    status: 'OPERATIONAL',
    locationId: LOCATION_IDS.centro,
    notes: null,
  },
  {
    code: 'EQ-0002',
    name: 'Máquina de helado soft',
    type: 'ICE_CREAM_MACHINE',
    brand: 'Carpigiani',
    model: 'Soft 191',
    serialNumber: null,
    purchaseDate: date('2024-02-10'),
    warrantyUntil: date('2027-02-10'),
    status: 'IN_REPAIR',
    locationId: LOCATION_IDS.centro,
    notes: 'Compressor noise; sent to the technician.',
  },
  {
    code: 'EQ-0003',
    name: 'Heladera de bebidas',
    type: 'REFRIGERATOR',
    brand: 'Gafa',
    model: 'HGF-350',
    serialNumber: null,
    purchaseDate: date('2022-11-20'),
    warrantyUntil: null,
    status: 'OPERATIONAL',
    locationId: LOCATION_IDS.norte,
    notes: null,
  },
  {
    code: 'EQ-0004',
    name: 'Freezer horizontal 300 L',
    type: 'FREEZER',
    brand: 'Inelro',
    model: 'FH-300',
    serialNumber: 'IN-FH300-7781',
    purchaseDate: date('2021-05-03'),
    warrantyUntil: null,
    status: 'OUT_OF_SERVICE',
    locationId: LOCATION_IDS.norte,
    notes: 'Does not hold temperature; awaiting a replacement decision.',
  },
  {
    code: 'EQ-0005',
    name: 'Freezer de exhibición',
    type: 'FREEZER',
    brand: 'Inelro',
    model: 'FIH-350',
    serialNumber: null,
    purchaseDate: date('2024-10-15'),
    warrantyUntil: date('2026-10-15'),
    status: 'OPERATIONAL',
    locationId: LOCATION_IDS.kioscoPlaza,
    notes: 'On loan to the kiosk.',
  },
  {
    code: 'EQ-0006',
    name: 'Batidora de crema',
    type: 'OTHER',
    brand: 'Moulinex',
    model: 'BT-600',
    serialNumber: null,
    purchaseDate: date('2019-01-08'),
    warrantyUntil: null,
    status: 'RETIRED',
    locationId: LOCATION_IDS.kioscoEstacion,
    notes: null,
  },
];

async function main(): Promise<void> {
  const { DATABASE_URL } = parseEnv(process.env);
  const prisma = createPrismaClient(DATABASE_URL);

  try {
    await prisma.$transaction(async (tx) => {
      for (const { id, ...data } of locations) {
        await tx.location.upsert({ where: { id }, update: data, create: { id, ...data } });
      }
      for (const { code, ...data } of equipment) {
        await tx.equipment.upsert({ where: { code }, update: data, create: { code, ...data } });
      }
    });
    console.log(`Seeded ${locations.length} locations and ${equipment.length} equipment items.`);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
