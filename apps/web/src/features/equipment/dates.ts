/** Warranty state of an item on a given day. */
export type WarrantyStatus = 'none' | 'active' | 'expired';

/** `YYYY-MM-DD` as `DD/MM/YYYY`, by string manipulation so no time zone can shift the day. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

/** An ISO 8601 instant in the browser's time zone, e.g. `1/10/26, 09:00`. */
export function formatDateTime(isoDateTime: string): string {
  return DATE_TIME_FORMAT.format(new Date(isoDateTime));
}

/** The local calendar date of `now` as `YYYY-MM-DD`. */
export function todayIsoDate(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Whether the warranty still covers `today` (both `YYYY-MM-DD`, which compare correctly as
 * text). The last day of the warranty is still covered.
 */
export function warrantyStatus(warrantyUntil: string | null, today: string): WarrantyStatus {
  if (warrantyUntil === null) {
    return 'none';
  }
  return warrantyUntil >= today ? 'active' : 'expired';
}
