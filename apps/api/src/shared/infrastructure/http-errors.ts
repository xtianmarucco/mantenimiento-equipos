import { STATUS_CODES } from 'node:http';

import type { ErrorResponse } from '@mantenimiento/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';

import { ConflictError } from '../domain/conflict-error.js';
import { DomainValidationError } from '../domain/domain-validation-error.js';
import { NotFoundError } from '../domain/not-found-error.js';
import { RequestValidationError } from './request-validation.js';

/** Catch-all for requests that no router handled. */
export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ErrorResponse = {
    error: { message: `Route ${req.method} ${req.originalUrl} not found` },
  };
  res.status(404).json(body);
};

function isMalformedJsonError(err: unknown): boolean {
  return err instanceof SyntaxError && 'type' in err && err.type === 'entity.parse.failed';
}

interface ClientError {
  status: number;
  message: string;
}

/**
 * Extracts a 4xx status set by the error (the `http-errors` convention used by body-parser,
 * for example 413 entity.too.large or 415 unsupported charset). Anything else is a server error.
 */
function toClientError(err: unknown): ClientError | undefined {
  if (typeof err !== 'object' || err === null) {
    return undefined;
  }

  const candidate = err as { status?: unknown; statusCode?: unknown; expose?: unknown };
  const status = candidate.status ?? candidate.statusCode;

  if (typeof status !== 'number' || !Number.isInteger(status) || status < 400 || status > 499) {
    return undefined;
  }

  // Only echo the message when the error explicitly marks it as safe to expose (http-errors sets
  // `expose: true` for 4xx); otherwise fall back to the generic status text, e.g. "Bad Request".
  const message =
    err instanceof Error && candidate.expose === true
      ? err.message
      : (STATUS_CODES[status] ?? 'Bad Request');

  return { status, message };
}

/** Central error handler: never leaks stack traces or internal messages to clients. */
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  // Once the response has started we cannot send a JSON body; let Express close the connection.
  if (res.headersSent) {
    next(err);
    return;
  }

  if (isMalformedJsonError(err)) {
    const body: ErrorResponse = { error: { message: 'Malformed JSON body' } };
    res.status(400).json(body);
    return;
  }

  if (err instanceof RequestValidationError) {
    const body: ErrorResponse = { error: { message: err.message, issues: [...err.issues] } };
    res.status(400).json(body);
    return;
  }

  if (err instanceof DomainValidationError) {
    const body: ErrorResponse = { error: { message: err.message, issues: [...err.issues] } };
    res.status(400).json(body);
    return;
  }

  if (err instanceof NotFoundError) {
    const body: ErrorResponse = { error: { message: err.message } };
    res.status(404).json(body);
    return;
  }

  if (err instanceof ConflictError) {
    const body: ErrorResponse = { error: { message: err.message } };
    res.status(409).json(body);
    return;
  }

  const clientError = toClientError(err);
  if (clientError) {
    const body: ErrorResponse = { error: { message: clientError.message } };
    res.status(clientError.status).json(body);
    return;
  }

  console.error(err);
  const body: ErrorResponse = { error: { message: 'Internal server error' } };
  res.status(500).json(body);
};
