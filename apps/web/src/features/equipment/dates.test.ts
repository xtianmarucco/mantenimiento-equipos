import { describe, expect, it } from 'vitest';

import { formatDate, todayIsoDate, warrantyStatus } from './dates';

describe('formatDate', () => {
  it('formats a calendar date as day/month/year without shifting time zones', () => {
    expect(formatDate('2025-01-05')).toBe('05/01/2025');
  });
});

describe('todayIsoDate', () => {
  it('uses the local calendar date', () => {
    expect(todayIsoDate(new Date(2026, 0, 9, 23, 59))).toBe('2026-01-09');
  });
});

describe('warrantyStatus', () => {
  it('is unknown without a warranty date', () => {
    expect(warrantyStatus(null, '2026-11-01')).toBe('none');
  });

  it('is active up to and including the last day', () => {
    expect(warrantyStatus('2026-11-01', '2026-11-01')).toBe('active');
    expect(warrantyStatus('2027-01-01', '2026-11-01')).toBe('active');
  });

  it('is expired the day after the last day', () => {
    expect(warrantyStatus('2026-10-31', '2026-11-01')).toBe('expired');
  });
});
