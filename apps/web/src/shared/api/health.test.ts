import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './client';
import { fetchHealth } from './health';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('fetchHealth', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests GET /api/health and returns the validated payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchHealth()).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('rejects with an ApiError when the response status is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, { status: 503 })));

    await expect(fetchHealth()).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects with an ApiError when the payload does not match the schema', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'down' })));

    await expect(fetchHealth()).rejects.toBeInstanceOf(ApiError);
  });

  it('wraps a network failure in an ApiError that keeps the original cause', async () => {
    const networkError = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError));

    const error: unknown = await fetchHealth().catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).cause).toBe(networkError);
  });

  it('wraps an unparseable JSON body in an ApiError that keeps the original cause', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('<html>not json</html>', { headers: { 'Content-Type': 'text/html' } }),
        ),
    );

    const error: unknown = await fetchHealth().catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).cause).toBeInstanceOf(SyntaxError);
  });

  it('lets an AbortError propagate unchanged', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    await expect(fetchHealth()).rejects.toBe(abortError);
  });
});
