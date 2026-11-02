import { useEffect, useState } from 'react';

import { ApiError } from '../api/client';

/** UI state of data loaded from the API. `message` is the API error message, when it sent one. */
export type ResourceState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message?: string | undefined };

/**
 * Runs `load` on mount and whenever it changes (memoize it with `useCallback`), aborting the
 * previous request. While a new `load` is pending the state is `loading` again.
 */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>): ResourceState<T> {
  // The settled state is tagged with the `load` that produced it, so a stale result never shows
  // for a newer request and no synchronous reset is needed when `load` changes.
  const [settled, setSettled] = useState<{
    load: typeof load;
    state: ResourceState<T>;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    load(controller.signal)
      .then((data) => setSettled({ load, state: { status: 'success', data } }))
      .catch((error: unknown) => {
        // An aborted request belongs to a newer `load` or an unmounted component; ignore it.
        if (!controller.signal.aborted) {
          const message = error instanceof ApiError ? error.apiMessage : undefined;
          setSettled({ load, state: { status: 'error', message } });
        }
      });

    return () => controller.abort();
  }, [load]);

  return settled?.load === load ? settled.state : { status: 'loading' };
}
