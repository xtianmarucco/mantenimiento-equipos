import type { z } from 'zod';

/** Raised when an API call fails: network error, non-2xx status or unexpected payload. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
}

interface GetJsonOptions {
  signal?: AbortSignal;
}

/**
 * GETs a JSON resource from the API and validates it against `schema`.
 * Paths are relative (`/api/...`): the Vite dev server proxies them to the API.
 */
export async function getJson<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  { signal }: GetJsonOptions = {},
): Promise<z.infer<Schema>> {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) {
    throw new ApiError(`GET ${path} failed with status ${response.status}`);
  }

  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ApiError(`GET ${path} returned an unexpected payload`);
  }
  return parsed.data;
}
