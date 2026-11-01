import { z } from 'zod';

import {
  hasAtLeastOneField,
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  optionalText,
  requiredText,
} from './common.js';

export const equipmentStatusSchema = z.enum([
  'OPERATIONAL',
  'IN_REPAIR',
  'OUT_OF_SERVICE',
  'RETIRED',
]);

export type EquipmentStatus = z.infer<typeof equipmentStatusSchema>;

export const equipmentTypeSchema = z.enum([
  'FREEZER',
  'REFRIGERATOR',
  'DISPLAY_CASE',
  'ICE_CREAM_MACHINE',
  'OTHER',
]);

export type EquipmentType = z.infer<typeof equipmentTypeSchema>;

/**
 * Format of an equipment code (also the QR payload): a prefix of 2 to 4 uppercase letters, a dash
 * and exactly 4 digits, e.g. `EQ-0042`.
 */
export const EQUIPMENT_CODE_PATTERN = /^[A-Z]{2,4}-\d{4}$/;

/** Internal equipment code. Input is trimmed and uppercased before the format check. */
export const equipmentCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(EQUIPMENT_CODE_PATTERN, 'Code must look like EQ-0042');

const equipmentFields = {
  code: equipmentCodeSchema,
  name: requiredText(120),
  type: equipmentTypeSchema,
  brand: requiredText(80),
  model: requiredText(80),
  serialNumber: optionalText(80),
  purchaseDate: isoDateSchema,
  warrantyUntil: isoDateSchema.nullable().optional(),
  status: equipmentStatusSchema,
  locationId: idSchema,
  notes: optionalText(1000),
};

/**
 * Warranty cannot end before the purchase date. Checked only when both dates are in the payload;
 * an update that sends one of them must be checked against the stored record by the API.
 * `YYYY-MM-DD` strings compare correctly as text.
 */
function warrantyNotBeforePurchase(
  value: { purchaseDate?: string | undefined; warrantyUntil?: string | null | undefined },
  ctx: z.RefinementCtx,
): void {
  const { purchaseDate, warrantyUntil } = value;
  if (purchaseDate && warrantyUntil && warrantyUntil < purchaseDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['warrantyUntil'],
      message: 'Warranty cannot end before the purchase date',
    });
  }
}

/** Body of `POST /api/equipment`. `status` defaults to `OPERATIONAL`. */
export const createEquipmentSchema = z
  .object({ ...equipmentFields, status: equipmentStatusSchema.default('OPERATIONAL') })
  .superRefine(warrantyNotBeforePurchase);

// Naming: `*Input` is the request body before parsing (`z.input`); the bare name is the parsed
// value (`z.infer`). The same convention applies to the location types.
export type CreateEquipmentInput = z.input<typeof createEquipmentSchema>;
export type CreateEquipment = z.infer<typeof createEquipmentSchema>;

/** Body of `PATCH /api/equipment/:id`: any subset of the create fields, at least one. */
export const updateEquipmentSchema = z
  .object(equipmentFields)
  .partial()
  .refine(hasAtLeastOneField, 'Provide at least one field to update')
  .superRefine(warrantyNotBeforePurchase);

export type UpdateEquipmentInput = z.input<typeof updateEquipmentSchema>;
export type UpdateEquipment = z.infer<typeof updateEquipmentSchema>;

/** An equipment item as returned by the API. Absent optional fields are `null`. */
export const equipmentResponseSchema = z.object({
  id: idSchema,
  code: z.string(),
  name: z.string(),
  type: equipmentTypeSchema,
  brand: z.string(),
  model: z.string(),
  serialNumber: z.string().nullable(),
  purchaseDate: isoDateSchema,
  warrantyUntil: isoDateSchema.nullable(),
  status: equipmentStatusSchema,
  locationId: idSchema,
  notes: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type EquipmentResponse = z.infer<typeof equipmentResponseSchema>;

/** Query string of `GET /api/equipment`; every filter is optional and they combine with AND. */
export const equipmentListQuerySchema = z.object({
  status: equipmentStatusSchema.optional(),
  locationId: idSchema.optional(),
  type: equipmentTypeSchema.optional(),
});

export type EquipmentListQuery = z.infer<typeof equipmentListQuerySchema>;
