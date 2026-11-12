import { z } from 'zod';

import {
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  optionalText,
  requiredText,
} from './common.js';
import { equipmentStatusSchema } from './equipment.js';

/** What happened to an equipment item. Events are append-only and drive its status and location. */
export const equipmentEventTypeSchema = z.enum([
  'MAINTENANCE',
  'BREAKDOWN',
  'REPAIR',
  'TRANSFER',
  'REPLACEMENT',
  'RETIREMENT',
]);

export type EquipmentEventType = z.infer<typeof equipmentEventTypeSchema>;

/** Largest cost accepted, matching a `DECIMAL(10, 2)` column. */
const MAX_COST = 99_999_999.99;

/** Optional cost in ARS: non-negative, at most two decimals. `null` means "no cost recorded". */
const costSchema = z.number().nonnegative().max(MAX_COST).multipleOf(0.01).nullable().optional();

/** The status a breakdown leaves the equipment in; the user picks one of the two. */
const breakdownStatusSchema = equipmentStatusSchema.extract(['IN_REPAIR', 'OUT_OF_SERVICE']);

/**
 * Fields every event has. Whether `occurredOn` is in the future or before the equipment's purchase
 * date depends on the server clock and the stored equipment, so the API checks it.
 */
const commonFields = {
  occurredOn: isoDateSchema,
  description: requiredText(1000),
};

const workFields = {
  technician: optionalText(120),
  cost: costSchema,
};

/**
 * Body of `POST /api/equipment/:id/events`, discriminated by `type`. Fields of other event types are
 * dropped, like any unknown key.
 */
export const createEquipmentEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('MAINTENANCE'), ...commonFields, ...workFields }),
  z.object({
    type: z.literal('BREAKDOWN'),
    ...commonFields,
    resultingStatus: breakdownStatusSchema,
  }),
  z.object({ type: z.literal('REPAIR'), ...commonFields, ...workFields }),
  z.object({ type: z.literal('TRANSFER'), ...commonFields, toLocationId: idSchema }),
  z.object({
    type: z.literal('REPLACEMENT'),
    ...commonFields,
    replacementEquipmentId: idSchema.nullable().optional(),
  }),
  z.object({ type: z.literal('RETIREMENT'), ...commonFields }),
]);

// Same naming convention as the equipment types: `*Input` before parsing, bare name after.
export type CreateEquipmentEventInput = z.input<typeof createEquipmentEventSchema>;
export type CreateEquipmentEvent = z.infer<typeof createEquipmentEventSchema>;

/**
 * An equipment event as returned by the API: one flat row, with `null` in the fields that do not
 * apply to its type.
 */
export const equipmentEventResponseSchema = z.object({
  id: idSchema,
  equipmentId: idSchema,
  type: equipmentEventTypeSchema,
  occurredOn: isoDateSchema,
  description: z.string(),
  technician: z.string().nullable(),
  cost: z.number().nullable(),
  resultingStatus: equipmentStatusSchema.nullable(),
  fromLocationId: idSchema.nullable(),
  toLocationId: idSchema.nullable(),
  replacementEquipmentId: idSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export type EquipmentEventResponse = z.infer<typeof equipmentEventResponseSchema>;
