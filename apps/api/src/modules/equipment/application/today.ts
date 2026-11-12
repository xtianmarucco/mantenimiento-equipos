import type { CalendarDate } from '../domain/equipment.js';

/** Today's calendar date (`YYYY-MM-DD`) in the process time zone (`TZ`), from the given clock. */
export function localToday(now: () => Date = () => new Date()): CalendarDate {
  const date = now();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
