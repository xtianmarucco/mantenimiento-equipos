import { useEffect, useState } from 'react';

import { fetchHealth } from '../../shared/api/health';
import type { HealthState } from './healthState';

/** Checks the API health once on mount; aborts the request on unmount. */
export function useHealthStatus(): HealthState {
  const [state, setState] = useState<HealthState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    fetchHealth({ signal: controller.signal })
      .then(() => setState({ status: 'ok' }))
      .catch(() => {
        // An aborted request belongs to an unmounted component; ignore it.
        if (!controller.signal.aborted) {
          setState({ status: 'error' });
        }
      });

    return () => controller.abort();
  }, []);

  return state;
}
