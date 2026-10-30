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
});
