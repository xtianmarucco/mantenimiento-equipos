import type { EquipmentEventResponse, LocationResponse } from '@mantenimiento/shared';
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';

import type { ResourceState } from '../../shared/hooks/useResource';
import { errorBox, secondaryButton, textLink } from '../../shared/ui/styles';
import { formatDate } from './dates';
import { EVENT_TYPE_LABELS, STATUS_LABELS } from './labels';

const MESSAGE_BOX = 'rounded-xl border border-slate-200 bg-white p-4 text-slate-700';

const COST_FORMAT = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

interface EquipmentEventHistoryProps {
  /** The history as returned by the API, newest first. */
  events: ResourceState<EquipmentEventResponse[]>;
  /** Locations, to name the ends of a transfer. */
  locations: ResourceState<LocationResponse[]>;
  onRetry: () => void;
}

/** Presentational, read-only event history of one equipment item. */
export function EquipmentEventHistory({ events, locations, onRetry }: EquipmentEventHistoryProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h3 id={headingId} className="text-lg font-semibold">
        Historial
      </h3>

      {events.status === 'loading' && (
        <p role="status" className={MESSAGE_BOX}>
          Cargando historial…
        </p>
      )}

      {events.status === 'error' && (
        <div role="alert" className={`space-y-3 ${errorBox}`}>
          <p className="font-medium">No se pudo cargar el historial.</p>
          <button type="button" className={secondaryButton} onClick={onRetry}>
            Reintentar
          </button>
        </div>
      )}

      {events.status === 'success' &&
        (events.data.length === 0 ? (
          <p className={MESSAGE_BOX}>Todavía no hay eventos registrados.</p>
        ) : (
          <ol className="space-y-3">
            {events.data.map((event) => (
              <EventItem key={event.id} event={event} locations={locations} />
            ))}
          </ol>
        ))}
    </section>
  );
}

function EventItem({
  event,
  locations,
}: {
  event: EquipmentEventResponse;
  locations: ResourceState<LocationResponse[]>;
}) {
  const details = eventDetails(event, locations);

  return (
    <li className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-slate-900">{EVENT_TYPE_LABELS[event.type]}</p>
        <time dateTime={event.occurredOn} className="text-sm text-slate-600">
          {formatDate(event.occurredOn)}
        </time>
      </div>
      <p className="whitespace-pre-line break-words text-slate-900">{event.description}</p>
      {details.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {details.map(({ label, value }) => (
            <Detail key={label} label={label}>
              {value}
            </Detail>
          ))}
        </dl>
      )}
    </li>
  );
}

/** The type-specific fields of an event that are set, in display order. */
function eventDetails(
  event: EquipmentEventResponse,
  locations: ResourceState<LocationResponse[]>,
): { label: string; value: ReactNode }[] {
  const details: { label: string; value: ReactNode }[] = [];
  if (event.technician !== null) {
    details.push({ label: 'Técnico', value: event.technician });
  }
  if (event.cost !== null) {
    details.push({ label: 'Costo', value: COST_FORMAT.format(event.cost) });
  }
  if (event.resultingStatus !== null) {
    details.push({ label: 'Estado resultante', value: STATUS_LABELS[event.resultingStatus] });
  }
  if (event.fromLocationId !== null) {
    details.push({ label: 'Desde', value: locationName(event.fromLocationId, locations) });
  }
  if (event.toLocationId !== null) {
    details.push({ label: 'Hacia', value: locationName(event.toLocationId, locations) });
  }
  if (event.replacementEquipmentId !== null) {
    details.push({
      label: 'Reemplazo',
      value: (
        <Link to={`/equipos/${event.replacementEquipmentId}`} className={textLink}>
          Ver equipo de reemplazo
        </Link>
      ),
    });
  }
  return details;
}

function locationName(locationId: string, locations: ResourceState<LocationResponse[]>): string {
  if (locations.status === 'loading') {
    return 'Cargando…';
  }
  if (locations.status === 'error') {
    return 'No se pudo cargar la ubicación.';
  }
  return locations.data.find((l) => l.id === locationId)?.name ?? 'Ubicación desconocida';
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-slate-600">{label}</dt>
      <dd className="break-words text-slate-900">{children}</dd>
    </>
  );
}
