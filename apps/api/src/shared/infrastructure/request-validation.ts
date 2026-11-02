import type { ErrorIssue } from '@mantenimiento/shared';
import type { z } from 'zod';

/** Part of an incoming request (body, params, query) failed its schema. Answered as 400. */
export class RequestValidationError extends Error {
  readonly issues: readonly ErrorIssue[];

  constructor(message: string, issues: readonly ErrorIssue[]) {
    super(message);
    this.name = 'RequestValidationError';
    this.issues = issues;
  }
}

/**
 * Parses untrusted request data with a schema. Failures become a `RequestValidationError`, so only
 * request input is ever answered as 400; a ZodError raised anywhere else stays a server error.
 */
export function parseRequest<T extends z.ZodType>(
  schema: T,
  value: unknown,
  message: string,
): z.output<T> {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  const issues = result.error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
  throw new RequestValidationError(message, issues);
}
