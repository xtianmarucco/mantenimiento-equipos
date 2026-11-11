import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { configureZodLocale } from './zodLocale';

describe('configureZodLocale', () => {
  it('switches the generic zod messages to Spanish', () => {
    configureZodLocale();

    const result = z.string().safeParse(42);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/^Entrada inválida/);
  });
});
