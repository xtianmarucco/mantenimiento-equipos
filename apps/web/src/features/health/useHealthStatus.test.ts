import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useHealthStatus } from './useHealthStatus';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('useHealthStatus', () => {
  it('starts in the loading state', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>(() => {})));

    const { result } = renderHook(() => useHealthStatus());

    expect(result.current).toEqual({ status: 'loading' });
  });

  it('resolves to ok when the API reports a healthy status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' })));

    const { result } = renderHook(() => useHealthStatus());

    await waitFor(() => expect(result.current).toEqual({ status: 'ok' }));
  });

  it('resolves to error when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const { result } = renderHook(() => useHealthStatus());

    await waitFor(() => expect(result.current).toEqual({ status: 'error' }));
  });

  it('resolves to error when the payload is invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ unexpected: true })));

    const { result } = renderHook(() => useHealthStatus());

    await waitFor(() => expect(result.current).toEqual({ status: 'error' }));
  });
});
