/**
 * Query parameters some PostgreSQL clients read as the database name (libpq and tokio-postgres
 * `dbname`, other drivers `database` or `db`). A later value can win over the URL path, so the
 * `_test` check on the path alone would not prove which database the suite truncates.
 */
const DATABASE_NAME_PARAMETERS = ['dbname', 'database', 'db'] as const;

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

  let url: URL;
  let databaseName: string;
  try {
    url = new URL(value);
    databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  } catch {
    throw new Error('DATABASE_URL is not a valid connection URL.');
  }
  const parameter = DATABASE_NAME_PARAMETERS.find((name) => url.searchParams.has(name));
  if (parameter) {
    throw new Error(
      `DATABASE_URL must name the database only in its path, not with "${parameter}=": the ` +
        'integration tests check that name before deleting every row.',
    );
  }
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run the integration tests against database "${databaseName}": they delete ` +
        'every row. Use a dedicated database whose name ends in "_test".',
    );
  }
  return value;
}
