import { useCallback } from 'react';

import { listLocations } from '../../shared/api/locations';
import { useResource } from '../../shared/hooks/useResource';
import { LocationList } from './LocationList';

/** Container: loads every location and hands the state to the presentational list. */
export function LocationListPage() {
  const locations = useResource(
    useCallback((signal: AbortSignal) => listLocations({ signal }), []),
  );
  return <LocationList state={locations} />;
}
