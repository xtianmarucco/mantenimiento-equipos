import { z } from 'zod';

/**
 * Makes zod's generic messages Spanish for the whole web app (zod keeps this in a global config,
 * so the shared schemas pick it up too). Messages set explicitly in a schema stay as written:
 * the forms translate those, and the friendlier per-field wording, by issue code and path.
 * The API is unaffected; it runs in another process with zod's default English locale.
 */
export function configureZodLocale(): void {
  z.config(z.locales.es());
}
