import { z } from 'zod';

import {
  hasAtLeastOneField,
  idSchema,
  isoDateTimeSchema,
  optionalText,
  requiredText,
} from './common.js';

/** Where equipment lives: one of the owner's stores, or a third-party kiosk that has it on loan. */
export const locationKindSchema = z.enum(['OWN_STORE', 'THIRD_PARTY']);

export type LocationKind = z.infer<typeof locationKindSchema>;

/**
 * Digits, spaces, dashes and parentheses, with an optional leading `+`. After trimming, the whole
 * value (the `+` included) must be 6 to 20 characters, matching the `phone VARCHAR(20)` column.
 */
const phoneSchema = z
  .string()
  .trim()
  .min(6, 'Invalid phone number')
  .max(20, 'Invalid phone number')
  .regex(/^\+?[0-9\s()-]+$/, 'Invalid phone number')
  .nullable()
  .optional();

const locationFields = {
  name: requiredText(120),
  kind: locationKindSchema,
  address: optionalText(200),
  contactName: optionalText(120),
  phone: phoneSchema,
};

/** Body of `POST /api/locations`. */
export const createLocationSchema = z.object(locationFields);

/** `POST /api/locations` body as a client sends it (before trimming and defaults). */
export type CreateLocationInput = z.input<typeof createLocationSchema>;
/**
 * `POST /api/locations` body after parsing: a data shape, not the API use case (which is
 * `CreateLocationUseCase` in `apps/api`).
 */
export type CreateLocation = z.infer<typeof createLocationSchema>;

/** Body of `PATCH /api/locations/:id`: any subset of the create fields, at least one. */
export const updateLocationSchema = z
  .object(locationFields)
  .partial()
  .refine(hasAtLeastOneField, 'Provide at least one field to update');

/** `PATCH /api/locations/:id` body as a client sends it. */
export type UpdateLocationInput = z.input<typeof updateLocationSchema>;
/**
 * `PATCH /api/locations/:id` body after parsing: a data shape, not the API use case (which is
 * `UpdateLocationUseCase` in `apps/api`).
 */
export type UpdateLocation = z.infer<typeof updateLocationSchema>;

/** A location as returned by the API. Absent optional fields are `null`. */
export const locationResponseSchema = z.object({
  id: idSchema,
  name: z.string(),
  kind: locationKindSchema,
  address: z.string().nullable(),
  contactName: z.string().nullable(),
  phone: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type LocationResponse = z.infer<typeof locationResponseSchema>;
