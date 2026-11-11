import type { LocationResponse } from '@mantenimiento/shared';
import { Link } from 'react-router';

import type { ResourceState } from '../../shared/hooks/useResource';
import { focusRing, primaryButton } from '../../shared/ui/styles';
import { LOCATION_KIND_LABELS } from './labels';

const MESSAGE_BOX = 'rounded-xl border border-slate-200 bg-white p-4 text-slate-700';

const BADGE =
  'rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800 ring-1 ring-inset ring-slate-700/20';

/** Presentational list of locations with loading, empty and error states. */
export function LocationList({ state }: { state: ResourceState<LocationResponse[]> }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Ubicaciones</h2>
        <Link to="/ubicaciones/nuevo" className={primaryButton}>
          Nueva ubicación
        </Link>
      </div>

      {state.status === 'loading' && (
        <p role="status" className={MESSAGE_BOX}>
          Cargando ubicaciones…
        </p>
      )}

      {state.status === 'error' && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
          <p className="font-medium">
            {state.message
              ? 'No se pudieron cargar las ubicaciones.'
              : 'No se pudieron cargar las ubicaciones. Intente de nuevo más tarde.'}
          </p>
          {state.message && <p className="mt-1 text-sm">Detalle: {state.message}</p>}
        </div>
      )}

      {state.status === 'success' &&
        (state.data.length === 0 ? (
          <p className={MESSAGE_BOX}>No hay ubicaciones registradas.</p>
        ) : (
          <ul aria-label="Ubicaciones" className="space-y-3">
            {state.data.map((location) => (
              <li key={location.id}>
                <Link
                  to={`/ubicaciones/${location.id}/editar`}
                  className={`block rounded-xl border border-slate-200 bg-white p-4 hover:border-teal-700 ${focusRing}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-slate-900">{location.name}</p>
                    <span className={BADGE}>{LOCATION_KIND_LABELS[location.kind]}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="text-slate-600">Dirección</dt>
                    <dd className="text-slate-900">{location.address ?? 'No informada'}</dd>
                    <dt className="text-slate-600">Contacto</dt>
                    <dd className="text-slate-900">{location.contactName ?? 'No informado'}</dd>
                    <dt className="text-slate-600">Teléfono</dt>
                    <dd className="text-slate-900">{location.phone ?? 'No informado'}</dd>
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
