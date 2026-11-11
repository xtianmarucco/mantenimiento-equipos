import type { LocationResponse } from '@mantenimiento/shared';
import { useCallback, useState } from 'react';

import { listLocations } from '../../shared/api/locations';
import { useResource } from '../../shared/hooks/useResource';
import { LocationList } from './LocationList';

/**
 * Container: loads every location and hands the state to the presentational list. Retrying
 * swaps in a fresh `load` so `useResource` requests the list again.
 */
export function LocationListPage() {
  const [load, setLoad] = useState<(signal: AbortSignal) => Promise<LocationResponse[]>>(
    () => (signal: AbortSignal) => listLocations({ signal }),
  );
  const locations = useResource(load);
  const retry = useCallback(
    () => setLoad(() => (signal: AbortSignal) => listLocations({ signal })),
    [],
  );
  return (
    <LocationList state={locations} onRetry={locations.status === 'error' ? retry : undefined} />
  );
}
