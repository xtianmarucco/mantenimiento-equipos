import { describe, expect, it } from 'vitest';

import { parseEnv } from './env.js';

const DATABASE_URL = 'postgresql://user:password@localhost:5432/mantenimiento';

describe('parseEnv', () => {
  it('applies defaults when only DATABASE_URL is set', () => {
    expect(parseEnv({ DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL,
    });
  });

  it('coerces PORT and accepts an explicit NODE_ENV', () => {
    expect(parseEnv({ DATABASE_URL, PORT: '8080', NODE_ENV: 'production' })).toEqual({
      NODE_ENV: 'production',
      PORT: 8080,
      DATABASE_URL,
    });
  });

  it('fails fast when DATABASE_URL is missing', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('fails fast on a non-PostgreSQL DATABASE_URL', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://localhost:3306/db' })).toThrow(/DATABASE_URL/);
  });

  it('fails fast on an invalid PORT', () => {
    expect(() => parseEnv({ DATABASE_URL, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => parseEnv({ DATABASE_URL, PORT: '70000' })).toThrow(/PORT/);
  });

  it('fails fast on an unknown NODE_ENV', () => {
    expect(() => parseEnv({ DATABASE_URL, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});
