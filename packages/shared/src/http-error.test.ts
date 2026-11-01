import { describe, expect, it } from 'vitest';

import { errorResponseSchema, type ErrorResponse } from './index.js';

describe('errorResponseSchema', () => {
  it('accepts an error with only a message', () => {
    const body: ErrorResponse = { error: { message: 'Location not found' } };

    expect(errorResponseSchema.parse(body)).toEqual(body);
  });

  it('accepts validation issues with a dotted path', () => {
    const body: ErrorResponse = {
      error: {
        message: 'Invalid request body',
        issues: [
          { path: 'name', message: 'Too small' },
          { path: '', message: 'Provide at least one field to update' },
        ],
      },
    };

    expect(errorResponseSchema.parse(body)).toEqual(body);
  });

  it('rejects a body without a message', () => {
    expect(errorResponseSchema.safeParse({ error: {} }).success).toBe(false);
  });
});
