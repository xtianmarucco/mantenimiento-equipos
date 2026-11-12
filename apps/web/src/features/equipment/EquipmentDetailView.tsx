import type {
  EquipmentEventResponse,
  EquipmentResponse,
  LocationResponse,
} from '@mantenimiento/shared';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';

import type { ResourceState } from '../../shared/hooks/useResource';
import {
  dangerButton,
  errorBox,
  primaryButton,
  secondaryButton,
  textLink,
} from '../../shared/ui/styles';
import { formatDate, formatDateTime, warrantyStatus } from './dates';
import { EquipmentEventHistory } from './EquipmentEventHistory';
import { TextAreaField } from './FormFields';
import { LOCATION_KIND_LABELS, STATUS_LABELS, TYPE_LABELS } from './labels';
import type { EquipmentNavigationState } from './navigation';
import { StatusBadge } from './StatusBadge';

/** Progress of the "retire" action. */
export type RetireState =
  | { step: 'idle' }
  | { step: 'confirming' }
  | { step: 'retiring' }
  | { step: 'failed' }
  /** Rejected before sending for a reason a retry cannot fix; `message` says why. */
  | { step: 'invalid'; message: string }
  | { step: 'done' };

interface EquipmentDetailViewProps {
  equipment: EquipmentResponse;
  locations: ResourceState<LocationResponse[]>;
  /** The event history, loaded on its own so a failure leaves the rest of the detail usable. */
  events: ResourceState<EquipmentEventResponse[]>;
  onEventsRetry: () => void;
  /** Today as `YYYY-MM-DD`, for the warranty status. */
  today: string;
  backTo: string;
  /** Forwarded to the edit and event pages so their "back" links keep the list filters. */
  navigationState: EquipmentNavigationState | undefined;
  retire: RetireState;
  /** The reason typed in the retire confirmation, sent as the retirement's description. */
  retireReason: string;
  retireReasonError: string | undefined;
  /** A new value moves focus to the reason field (after a validation error). */
  retireReasonFocus: number;
  onRetireReasonChange: (value: string) => void;
  onRetireRequest: () => void;
  onRetireCancel: () => void;
  onRetireConfirm: () => void;
}

const WARRANTY_LABELS = {
  active: 'En garantía',
  expired: 'Garantía vencida',
} as const;

/**
 * Presentational equipment detail: every field, the edit and "register event" links, the retire
 * action and the event history.
 */
export function EquipmentDetailView({
  equipment,
  locations,
  events,
  onEventsRetry,
  today,
  backTo,
  navigationState,
  retire,
  retireReason,
  retireReasonError,
  retireReasonFocus,
  onRetireReasonChange,
  onRetireRequest,
  onRetireCancel,
  onRetireConfirm,
}: EquipmentDetailViewProps) {
  const isRetired = equipment.status === 'RETIRED';
  const showConfirmation =
    !isRetired &&
    (retire.step === 'confirming' ||
      retire.step === 'retiring' ||
      retire.step === 'failed' ||
      retire.step === 'invalid');

  return (
    <section className="space-y-4">
      <Link to={backTo} className={textLink}>
        Volver a equipos
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{equipment.name}</h2>
          <p className="font-mono text-sm text-slate-600">{equipment.code}</p>
        </div>
        <StatusBadge status={equipment.status} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to={`/equipos/${equipment.id}/editar`}
          state={navigationState}
          className={primaryButton}
        >
          Editar
        </Link>
        {!isRetired && (
          <Link
            to={`/equipos/${equipment.id}/eventos/nuevo`}
            state={navigationState}
            className={secondaryButton}
          >
            Registrar evento
          </Link>
        )}
        {!isRetired && !showConfirmation && (
          <button type="button" className={dangerButton} onClick={onRetireRequest}>
            Dar de baja
          </button>
        )}
      </div>

      {retire.step === 'done' && (
        <p role="status" className="rounded-xl border border-slate-200 bg-white p-4">
          El equipo fue dado de baja.
        </p>
      )}
      {isRetired && retire.step !== 'done' && (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-700">
          Este equipo está dado de baja.
        </p>
      )}

      {showConfirmation && (
        <RetireConfirmation
          retiring={retire.step === 'retiring'}
          failed={retire.step === 'failed'}
          invalidMessage={retire.step === 'invalid' ? retire.message : undefined}
          reason={retireReason}
          reasonError={retireReasonError}
          reasonFocus={retireReasonFocus}
          onReasonChange={onRetireReasonChange}
          onCancel={onRetireCancel}
          onConfirm={onRetireConfirm}
        />
      )}

      <dl className="grid gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[auto_1fr]">
        <Field label="Código">
          <span className="font-mono">{equipment.code}</span>
        </Field>
        <Field label="Nombre">{equipment.name}</Field>
        <Field label="Estado">{STATUS_LABELS[equipment.status]}</Field>
        <Field label="Tipo">{TYPE_LABELS[equipment.type]}</Field>
        <Field label="Marca">{equipment.brand}</Field>
        <Field label="Modelo">{equipment.model}</Field>
        <Field label="Número de serie">{equipment.serialNumber ?? 'No informado'}</Field>
        <Field label="Fecha de compra">{formatDate(equipment.purchaseDate)}</Field>
        <Field label="Garantía hasta">
          <WarrantyValue warrantyUntil={equipment.warrantyUntil} today={today} />
        </Field>
        <Field label="Ubicación">{locationLabel(equipment.locationId, locations)}</Field>
        <Field label="Notas">
          <span className="whitespace-pre-line">{equipment.notes ?? 'Sin notas'}</span>
        </Field>
        <Field label="Creado">
          <time dateTime={equipment.createdAt}>{formatDateTime(equipment.createdAt)}</time>
        </Field>
        <Field label="Actualizado">
          <time dateTime={equipment.updatedAt}>{formatDateTime(equipment.updatedAt)}</time>
        </Field>
      </dl>

      <EquipmentEventHistory events={events} locations={locations} onRetry={onEventsRetry} />
    </section>
  );
}

function locationLabel(locationId: string, locations: ResourceState<LocationResponse[]>): string {
  if (locations.status === 'loading') {
    return 'Cargando…';
  }
  if (locations.status === 'error') {
    return 'No se pudo cargar la ubicación.';
  }
  const location =
    locations.status === 'success' ? locations.data.find((l) => l.id === locationId) : undefined;
  return location
    ? `${location.name} (${LOCATION_KIND_LABELS[location.kind]})`
    : 'Ubicación desconocida';
}

function WarrantyValue({ warrantyUntil, today }: { warrantyUntil: string | null; today: string }) {
  const status = warrantyStatus(warrantyUntil, today);
  if (warrantyUntil === null || status === 'none') {
    return <>Sin garantía registrada</>;
  }
  const badge =
    status === 'active'
      ? 'bg-emerald-100 text-emerald-900 ring-emerald-700/30'
      : 'bg-slate-200 text-slate-800 ring-slate-700/30';
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>{formatDate(warrantyUntil)}</span>
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badge}`}
      >
        {WARRANTY_LABELS[status]}
      </span>
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="text-slate-900">{children}</dd>
    </>
  );
}

interface RetireConfirmationProps {
  retiring: boolean;
  failed: boolean;
  /** Why the retirement cannot be confirmed; hides the confirm button. */
  invalidMessage: string | undefined;
  reason: string;
  reasonError: string | undefined;
  reasonFocus: number;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Inline confirmation step for retiring, with the required reason; takes focus when it opens, and
 * moves it to the reason when `reasonFocus` changes.
 */
function RetireConfirmation({
  retiring,
  failed,
  invalidMessage,
  reason,
  reasonError,
  reasonFocus,
  onReasonChange,
  onCancel,
  onConfirm,
}: RetireConfirmationProps) {
  const titleId = useId();
  const descriptionId = useId();
  const reasonId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    if (reasonFocus > 0) {
      document.getElementById(reasonId)?.focus();
    }
  }, [reasonFocus, reasonId]);

  return (
    <div
      ref={panelRef}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      tabIndex={-1}
      className="space-y-3 rounded-xl border border-red-200 bg-white p-4 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
    >
      <h3 id={titleId} className="font-semibold">
        ¿Dar de baja este equipo?
      </h3>
      <p id={descriptionId} className="text-slate-700">
        El equipo pasará al estado “Dado de baja” y dejará de aparecer en la lista de equipos
        activos. La baja es definitiva: el equipo no admitirá más eventos.
      </p>
      <TextAreaField
        id={reasonId}
        name="reason"
        label="Motivo"
        rows={3}
        value={reason}
        error={reasonError}
        onValue={onReasonChange}
      />
      {failed && (
        <p role="alert" className={errorBox}>
          No se pudo dar de baja el equipo. Intente de nuevo.
        </p>
      )}
      {invalidMessage !== undefined && (
        <p role="alert" className={errorBox}>
          {invalidMessage}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {invalidMessage === undefined && (
          <button type="button" className={dangerButton} onClick={onConfirm} disabled={retiring}>
            {retiring ? 'Dando de baja…' : 'Confirmar baja'}
          </button>
        )}
        <button type="button" className={secondaryButton} onClick={onCancel} disabled={retiring}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
