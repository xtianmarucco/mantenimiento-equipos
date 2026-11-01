import type { EquipmentResponse } from '@mantenimiento/shared';
import { Link } from 'react-router';

import type { ResourceState } from '../../shared/hooks/useResource';
import { focusRing } from '../../shared/ui/styles';
import { TYPE_LABELS } from './labels';
import type { EquipmentNavigationState } from './navigation';
import { StatusBadge } from './StatusBadge';

interface EquipmentListProps {
  state: ResourceState<EquipmentResponse[]>;
  /** Location names by id; a missing id shows as unknown. */
  locationNames: ReadonlyMap<string, string>;
  /** Router state passed to the detail links (the list filters, for "back"). */
  navigationState?: EquipmentNavigationState | undefined;
}

const MESSAGE_BOX = 'rounded-xl border border-slate-200 bg-white p-4 text-slate-700';

/** Presentational list of equipment with loading, empty and error states. */
export function EquipmentList({ state, locationNames, navigationState }: EquipmentListProps) {
  if (state.status === 'loading') {
    return (
      <p role="status" className={MESSAGE_BOX}>
        Cargando equipos…
      </p>
    );
  }

  if (state.status === 'error') {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
        <p className="font-medium">
          No se pudieron cargar los equipos. Intente de nuevo más tarde.
        </p>
        {state.message && <p className="mt-1 text-sm">Detalle: {state.message}</p>}
      </div>
    );
  }

  if (state.data.length === 0) {
    return <p className={MESSAGE_BOX}>No hay equipos para estos filtros</p>;
  }

  return (
    <ul aria-label="Equipos" className="space-y-3">
      {state.data.map((item) => (
        <li key={item.id}>
          <EquipmentListItem
            item={item}
            locationName={locationNames.get(item.locationId) ?? 'Ubicación desconocida'}
            navigationState={navigationState}
          />
        </li>
      ))}
    </ul>
  );
}

function EquipmentListItem({
  item,
  locationName,
  navigationState,
}: {
  item: EquipmentResponse;
  locationName: string;
  navigationState: EquipmentNavigationState | undefined;
}) {
  return (
    <Link
      to={`/equipos/${item.id}`}
      state={navigationState}
      className={`block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-teal-600 ${focusRing}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{item.name}</p>
          <p className="font-mono text-sm text-slate-600">{item.code}</p>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-600">Tipo</dt>
        <dd className="text-slate-900">{TYPE_LABELS[item.type]}</dd>
        <dt className="text-slate-600">Ubicación</dt>
        <dd className="text-slate-900">{locationName}</dd>
      </dl>
    </Link>
  );
}
