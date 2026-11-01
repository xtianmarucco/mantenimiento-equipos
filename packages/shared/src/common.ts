import { z } from 'zod';

/** Calendar date without time or zone, `YYYY-MM-DD` (rejects impossible dates like `02-30`). */
export const isoDateSchema = z.iso.date();

/** Instant in ISO 8601 UTC form, e.g. `2026-11-01T12:00:00.000Z`. Used for timestamps. */
export const isoDateTimeSchema = z.iso.datetime();

/** Identifier of a persisted record (UUID). */
export const idSchema = z.uuid();

/**
 * Required free text: trimmed, not blank, at most `max` characters.
 */
export function requiredText(max: number) {
  return z.string().trim().min(1).max(max);
}

/**
 * Optional free text: trimmed, not blank when present, at most `max` characters. `null` means
 * "no value", so updates can clear the field.
 */
export function optionalText(max: number) {
  return requiredText(max).nullable().optional();
}

/** Rejects an update payload with no fields. */
export function hasAtLeastOneField(value: object): boolean {
  return Object.keys(value).length > 0;
}
