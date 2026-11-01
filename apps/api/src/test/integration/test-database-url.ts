/**
 * Reads `DATABASE_URL` for the integration suite and refuses anything that does not look like a
 * dedicated test database: the suite truncates every table between tests.
 */
export function requireTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const value = env['DATABASE_URL'];
  if (!value) {
    throw new Error(
      'DATABASE_URL is required for the integration tests (pnpm test:integration). Point it at a ' +
        'disposable PostgreSQL database whose name ends in "_test"; see README.md.',
    );
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(new URL(value).pathname.replace(/^\//, ''));
  } catch {
    throw new Error('DATABASE_URL is not a valid connection URL.');
  }
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run the integration tests against database "${databaseName}": they delete ` +
        'every row. Use a dedicated database whose name ends in "_test".',
    );
  }
  return value;
}
