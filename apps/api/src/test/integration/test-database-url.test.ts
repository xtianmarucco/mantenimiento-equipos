import { describe, expect, it } from 'vitest';

import { requireTestDatabaseUrl } from './test-database-url.js';

describe('requireTestDatabaseUrl', () => {
  it('returns DATABASE_URL when it names a database ending in _test', () => {
    const url = 'postgresql://ci:secret@localhost:5432/mantenimiento_test';

    expect(requireTestDatabaseUrl({ DATABASE_URL: url })).toBe(url);
  });

  it('fails clearly when DATABASE_URL is missing', () => {
    expect(() => requireTestDatabaseUrl({})).toThrow(/DATABASE_URL is required/);
  });

  it('refuses a database that is not a dedicated test database', () => {
    expect(() =>
      requireTestDatabaseUrl({ DATABASE_URL: 'postgresql://dev:dev@localhost:5432/mantenimiento' }),
    ).toThrow(/Refusing to run the integration tests against database "mantenimiento"/);
  });

  it('rejects a value that is not a URL', () => {
    expect(() => requireTestDatabaseUrl({ DATABASE_URL: 'not a url' })).toThrow(/not a valid/);
  });
});
