import type { EquipmentListQuery, EquipmentResponse } from '@mantenimiento/shared';
import { Link } from 'react-router';

import type { ResourceState } from '../../shared/hooks/useResource';
import { focusRing } from '../../shared/ui/styles';
import { EquipmentFilterBar, type LocationOption } from './EquipmentFilterBar';
import { EquipmentList } from './EquipmentList';

interface EquipmentListViewProps {
  filters: EquipmentListQuery;
  equipment: ResourceState<EquipmentResponse[]>;
  locations: ResourceState<LocationOption[]>;
  onFiltersChange: (filters: EquipmentListQuery) => void;
}

/** Presentational equipment list page: heading, "new" action, filters and results. */
export function EquipmentListView({
  filters,
  equipment,
  locations,
  onFiltersChange,
}: EquipmentListViewProps) {
  const locationNames = new Map(
    locations.status === 'success' ? locations.data.map((l) => [l.id, l.name] as const) : [],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Equipos</h2>
        <Link
          to="/equipos/nuevo"
          className={`inline-flex min-h-11 items-center rounded-md bg-teal-700 px-4 font-medium text-white hover:bg-teal-800 ${focusRing}`}
        >
          Nuevo equipo
        </Link>
      </div>
      <EquipmentFilterBar filters={filters} locations={locations} onChange={onFiltersChange} />
      <EquipmentList state={equipment} locationNames={locationNames} />
    </section>
  );
}
