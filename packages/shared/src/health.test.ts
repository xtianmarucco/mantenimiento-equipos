import { describe, expect, it } from 'vitest';

import { healthResponseSchema, type HealthResponse } from './index.js';

describe('healthResponseSchema', () => {
  it('accepts an ok health response', () => {
    const response: HealthResponse = { status: 'ok' };

    expect(healthResponseSchema.parse(response)).toEqual({ status: 'ok' });
  });

  it('rejects any status other than ok', () => {
    const result = healthResponseSchema.safeParse({ status: 'down' });

    expect(result.success).toBe(false);
  });

  it('rejects a payload without status', () => {
    expect(healthResponseSchema.safeParse({}).success).toBe(false);
  });
});
