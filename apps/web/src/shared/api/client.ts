import { errorResponseSchema } from '@mantenimiento/shared';
import type { z } from 'zod';

interface ApiErrorOptions extends ErrorOptions {
  /** HTTP status of a non-2xx response. */
  status?: number | undefined;
  /** `error.message` of a response that follows the API error contract. */
  apiMessage?: string | undefined;
}

/** Raised when an API call fails: network error, non-2xx status or unexpected payload. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number | undefined;
  readonly apiMessage: string | undefined;

  constructor(message: string, { status, apiMessage, ...options }: ApiErrorOptions = {}) {
    super(message, options);
    this.status = status;
    this.apiMessage = apiMessage;
  }
}

/** The `error.message` of an error response body, when it follows the API error contract. */
async function readApiMessage(response: Response): Promise<string | undefined> {
  try {
    const parsed = errorResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.error.message : undefined;
  } catch {
    return undefined;
  }
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
    throw new ApiError(`GET ${path} failed with status ${response.status}`, {
      status: response.status,
      apiMessage: await readApiMessage(response),
    });
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
