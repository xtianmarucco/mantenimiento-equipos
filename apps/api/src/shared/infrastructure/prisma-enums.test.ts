import {
  equipmentStatusSchema,
  equipmentTypeSchema,
  locationKindSchema,
} from '@mantenimiento/shared';
import { describe, expect, it } from 'vitest';

import { EquipmentStatus, EquipmentType, LocationKind } from '../../generated/prisma/enums.js';

// The Prisma enums in `prisma/schema.prisma` are written by hand to mirror the zod enums in
// `packages/shared`. This test fails when one side gains, loses or reorders a value.
describe('Prisma enums match the shared zod enums', () => {
  it.each([
    ['LocationKind', LocationKind, locationKindSchema.options],
    ['EquipmentType', EquipmentType, equipmentTypeSchema.options],
    ['EquipmentStatus', EquipmentStatus, equipmentStatusSchema.options],
  ])('%s', (_name, prismaEnum, zodOptions) => {
    expect(Object.values(prismaEnum)).toEqual(zodOptions);
  });
});
