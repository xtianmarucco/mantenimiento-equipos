import type { z } from 'zod';

/** Raised when an API call fails: network error, non-2xx status or unexpected payload. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
}

/**
 * Wraps a failure in an `ApiError`, keeping it as `cause`. An `AbortError` is returned unchanged
 * so callers can tell a cancelled request apart from a failed one.
 */
function wrapUnlessAborted(error: unknown, message: string): unknown {
  // Check the name rather than `instanceof DOMException`: the error may come from another realm.
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  ) {
    return error;
  }
  return new ApiError(message, { cause: error });
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
  let response: Response;
  try {
    response = await fetch(path, {
      headers: { Accept: 'application/json' },
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    throw wrapUnlessAborted(error, `GET ${path} failed: network error`);
  }
  if (!response.ok) {
    throw new ApiError(`GET ${path} failed with status ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw wrapUnlessAborted(error, `GET ${path} returned a body that is not valid JSON`);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(`GET ${path} returned an unexpected payload`);
  }
  return parsed.data;
}
