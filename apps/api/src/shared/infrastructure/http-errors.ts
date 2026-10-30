import type { ErrorRequestHandler, RequestHandler } from 'express';

/** JSON body returned for every error response. */
export interface ErrorResponse {
  error: { message: string };
}

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

/** Central error handler: never leaks stack traces or internal messages to clients. */
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (isMalformedJsonError(err)) {
    const body: ErrorResponse = { error: { message: 'Malformed JSON body' } };
    res.status(400).json(body);
    return;
  }

  console.error(err);
  const body: ErrorResponse = { error: { message: 'Internal server error' } };
  res.status(500).json(body);
};
