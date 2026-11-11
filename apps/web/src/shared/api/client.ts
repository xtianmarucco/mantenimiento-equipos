import { errorResponseSchema, type ErrorIssue } from '@mantenimiento/shared';
import type { z } from 'zod';

interface ApiErrorOptions extends ErrorOptions {
  /** HTTP status of a non-2xx response. */
  status?: number | undefined;
  /** `error.message` of a response that follows the API error contract. */
  apiMessage?: string | undefined;
  /** `error.issues` of a validation error response (400) that follows the API error contract. */
  issues?: readonly ErrorIssue[] | undefined;
}

/** Raised when an API call fails: network error, non-2xx status or unexpected payload. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number | undefined;
  readonly apiMessage: string | undefined;
  readonly issues: readonly ErrorIssue[] | undefined;

  constructor(message: string, { status, apiMessage, issues, ...options }: ApiErrorOptions = {}) {
    super(message, options);
    this.status = status;
    this.apiMessage = apiMessage;
    this.issues = issues;
  }
}

/** The `error` of an error response body, when it follows the API error contract. */
async function readApiError(
  response: Response,
): Promise<Pick<ApiErrorOptions, 'apiMessage' | 'issues'>> {
  try {
    const parsed = errorResponseSchema.safeParse(await response.json());
    return parsed.success
      ? { apiMessage: parsed.data.error.message, issues: parsed.data.error.issues }
      : {};
  } catch {
    return {};
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

type Method = 'GET' | 'POST' | 'PATCH';

interface RequestJsonOptions extends GetJsonOptions {
  /** Sent as a JSON body; omitted for requests without one. */
  body?: unknown;
}

/**
 * Sends a request to the API and validates the JSON response against `schema`. Paths are
 * relative (`/api/...`): the Vite dev server (and nginx in Docker) proxies them to the API.
 */
async function requestJson<Schema extends z.ZodType>(
  method: Method,
  path: string,
  schema: Schema,
  { signal, body }: RequestJsonOptions = {},
): Promise<z.infer<Schema>> {
  const label = `${method} ${path}`;
  const hasBody = body !== undefined;
  let response: Response;
  try {
    response = await fetch(path, {
      ...(method === 'GET' ? {} : { method }),
      headers: {
        Accept: 'application/json',
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(hasBody ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    throw wrapUnlessAborted(error, `${label} failed: network error`);
  }
  if (!response.ok) {
    throw new ApiError(`${label} failed with status ${response.status}`, {
      status: response.status,
      ...(await readApiError(response)),
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw wrapUnlessAborted(error, `${label} returned a body that is not valid JSON`);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(`${label} returned an unexpected payload`);
  }
  return parsed.data;
}

/** GETs a JSON resource from the API and validates it against `schema`. */
export function getJson<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  options: GetJsonOptions = {},
): Promise<z.infer<Schema>> {
  return requestJson('GET', path, schema, options);
}

/**
 * Sends a `POST` or `PATCH` (with `body` as JSON, when given) and validates the JSON response
 * against `schema`. Failures raise `ApiError` like `getJson`, with the API `issues` on a 400.
 */
export function sendJson<Schema extends z.ZodType>(
  method: Exclude<Method, 'GET'>,
  path: string,
  schema: Schema,
  options: RequestJsonOptions = {},
): Promise<z.infer<Schema>> {
  return requestJson(method, path, schema, options);
}
