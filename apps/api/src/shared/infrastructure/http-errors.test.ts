import express, { type Express, type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { errorHandler, notFoundHandler } from './http-errors.js';

/** Minimal app whose routes fail in controlled ways, wired to the real handlers. */
function createFailingApp(): Express {
  const app = express();

  app.get('/boom', () => {
    throw new Error('database password is hunter2');
  });

  app.get('/client-error', () => {
    throw Object.assign(new Error('unsupported charset "LATIN-9"'), { status: 415 });
  });

  app.get('/status-code-error', () => {
    throw Object.assign(new Error('request aborted'), { statusCode: 400 });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

describe('errorHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers unexpected errors with a JSON 500 that hides the internal message', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await request(createFailingApp()).get('/boom');

    expect(response.status).toBe(500);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({ error: { message: 'Internal server error' } });
    expect(JSON.stringify(response.body)).not.toContain('hunter2');
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it('preserves a 4xx `status` from the error as a JSON client error without logging', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await request(createFailingApp()).get('/client-error');

    expect(response.status).toBe(415);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({ error: { message: 'unsupported charset "LATIN-9"' } });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('preserves a 4xx `statusCode` from the error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await request(createFailingApp()).get('/status-code-error');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { message: 'request aborted' } });
  });

  it('delegates to the next handler when headers were already sent', () => {
    const err = new Error('failed mid-stream');
    const res = { headersSent: true, status: vi.fn(), json: vi.fn() };
    const next = vi.fn();

    errorHandler(err, {} as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
