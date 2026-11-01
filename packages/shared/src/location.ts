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

/** Digits with optional leading `+`, spaces, dashes and parentheses; 6 to 20 characters. */
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s()-]{6,20}$/, 'Invalid phone number')
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

export type CreateLocationInput = z.infer<typeof createLocationSchema>;

/** Body of `PATCH /api/locations/:id`: any subset of the create fields, at least one. */
export const updateLocationSchema = z
  .object(locationFields)
  .partial()
  .refine(hasAtLeastOneField, 'Provide at least one field to update');

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

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
