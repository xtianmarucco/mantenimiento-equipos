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

  it('passes an AbortSignal to fetch and aborts it on unmount', () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() => useHealthStatus());
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;

    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.signal?.aborted).toBe(false);

    unmount();

    expect(init?.signal?.aborted).toBe(true);
  });

  it('ignores the rejection of an aborted request without updating state', async () => {
    const consoleError = vi.spyOn(console, 'error');
    // Behave like the real fetch: reject with an AbortError once the signal aborts.
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          );
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result, unmount } = renderHook(() => useHealthStatus());
    unmount();
    // Let the rejection and the hook's catch handler run.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.current).toEqual({ status: 'loading' });
    expect(consoleError).not.toHaveBeenCalled();
  });
});
