import type { EquipmentListQuery } from '@mantenimiento/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { listEquipment } from '../../shared/api/equipment';
import { listLocations } from '../../shared/api/locations';
import { useResource } from '../../shared/hooks/useResource';
import { EquipmentListView } from './EquipmentListView';
import { filtersFromSearchParams, filtersToSearchParams } from './filters';

/**
 * Container: the URL query string is the source of truth for the filters, so they survive a
 * reload and can be shared. Loads equipment for those filters and the locations for the filter
 * and the item labels.
 */
export function EquipmentListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);

  const loadEquipment = useCallback(
    (signal: AbortSignal) => listEquipment(filters, { signal }),
    [filters],
  );
  const equipment = useResource(loadEquipment);
  const locations = useResource(
    useCallback((signal: AbortSignal) => listLocations({ signal }), []),
  );

  // Replace the history entry: filter tweaks should not pile up behind the back button.
  const onFiltersChange = useCallback(
    (next: EquipmentListQuery) => setSearchParams(filtersToSearchParams(next), { replace: true }),
    [setSearchParams],
  );

  return (
    <EquipmentListView
      filters={filters}
      equipment={equipment}
      locations={locations}
      onFiltersChange={onFiltersChange}
    />
  );
}
