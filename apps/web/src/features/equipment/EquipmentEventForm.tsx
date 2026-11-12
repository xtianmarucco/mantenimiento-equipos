import { type EquipmentResponse, type LocationResponse } from '@mantenimiento/shared';
import { useEffect, useId, useRef, type FormEvent } from 'react';
import { Link } from 'react-router';

import type { ResourceState } from '../../shared/hooks/useResource';
import { errorBox, focusRing, primaryButton, secondaryButton } from '../../shared/ui/styles';
import {
  eventTypesForStatus,
  fieldsForEventType,
  type EventFieldErrors,
  type EventFormField,
  type EventFormValues,
  type OptionsField,
} from './equipmentEventFormModel';
import type { FormError } from './equipmentFormModel';
import { LocationSelectField, SelectField, TextAreaField, TextField } from './FormFields';
import { EVENT_TYPE_LABELS, STATUS_LABELS } from './labels';
import type { EquipmentNavigationState } from './navigation';

/** Asks the form to move focus; a new `seq` repeats the request for the same target. */
export interface EventFocusRequest {
  target: EventFormField | 'form';
  seq: number;
}

export interface EquipmentEventFormProps {
  /** The item the event is recorded for; its status decides the event types offered. */
  equipment: EquipmentResponse;
  values: EventFormValues;
  errors: EventFieldErrors;
  formError: FormError | undefined;
  /** Transfer destinations (the current location is left out). */
  locations: ResourceState<LocationResponse[]>;
  /** Replacement candidates (this item and retired ones are left out). */
  replacements: ResourceState<EquipmentResponse[]>;
  /** Today as `YYYY-MM-DD`: the latest date the date input accepts. */
  today: string;
  saving: boolean;
  focusRequest: EventFocusRequest | null;
  cancelTo: string;
  cancelState?: EquipmentNavigationState | undefined;
  onChange: (field: EventFormField, value: string) => void;
  onSubmit: () => void;
  /** Retries the locations request; offered only while the locations state is `error`. */
  onRetryLocations?: (() => void) | undefined;
  /** Retries the replacement candidates request; offered only while their state is `error`. */
  onRetryReplacements?: (() => void) | undefined;
}

const REPLACEMENTS_ERROR = 'No se pudieron cargar los equipos.';
const BREAKDOWN_STATUSES = ['IN_REPAIR', 'OUT_OF_SERVICE'] as const;

/**
 * Presentational "register event" form. Controlled: values, errors and the saving flag come from
 * the container, which validates and submits. Only the fields of the chosen type are shown.
 * Native validation is off (`noValidate`) so every message comes from the shared schema, in
 * Spanish.
 */
export function EquipmentEventForm({
  equipment,
  values,
  errors,
  formError,
  locations,
  replacements,
  today,
  saving,
  focusRequest,
  cancelTo,
  cancelState,
  onChange,
  onSubmit,
  onRetryLocations,
  onRetryReplacements,
}: EquipmentEventFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId();
  const shown = new Set(fieldsForEventType(values.type));

  useEffect(() => {
    if (!focusRequest) return;
    const form = formRef.current;
    if (focusRequest.target === 'form') {
      formErrorRef.current?.focus();
      return;
    }
    const control = form?.elements.namedItem(focusRequest.target);
    if (!(control instanceof HTMLElement)) return;
    if (control instanceof HTMLSelectElement && control.disabled) {
      // A disabled control cannot take focus: its options did not load. Focus the way out
      // instead, its retry button, or the form error that explains the wait.
      const retry = form?.querySelector<HTMLElement>(`[data-retry-for="${focusRequest.target}"]`);
      (retry ?? formErrorRef.current)?.focus();
      return;
    }
    control.focus();
  }, [focusRequest]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saving) {
      onSubmit();
    }
  }

  // Props shared by every field: ids, value, change handler and error wiring.
  function field(name: EventFormField) {
    return {
      id: `${idPrefix}-${name}`,
      name,
      value: values[name],
      error: errors[name],
      onValue: (value: string) => onChange(name, value),
    };
  }

  function retryButton(name: OptionsField, onRetry: (() => void) | undefined) {
    return onRetry ? (
      <button type="button" data-retry-for={name} onClick={onRetry} className={secondaryButton}>
        Reintentar
      </button>
    ) : undefined;
  }

  const candidates =
    replacements.status === 'success'
      ? replacements.data.filter((item) => item.id !== equipment.id && item.status !== 'RETIRED')
      : [];

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      aria-label="Registrar evento"
      className="space-y-4"
    >
      {formError && (
        <div ref={formErrorRef} role="alert" tabIndex={-1} className={`${errorBox} ${focusRing}`}>
          <p className="font-medium">{formError.message}</p>
          {formError.detail && <p className="mt-1 text-sm">Detalle: {formError.detail}</p>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField {...field('type')} label="Tipo de evento">
          <option value="">Seleccione un tipo</option>
          {eventTypesForStatus(equipment.status).map((type) => (
            <option key={type} value={type}>
              {EVENT_TYPE_LABELS[type]}
            </option>
          ))}
        </SelectField>

        <TextField {...field('occurredOn')} label="Fecha" type="date" max={today} />

        {shown.has('resultingStatus') && (
          <SelectField {...field('resultingStatus')} label="Estado resultante">
            <option value="">Seleccione un estado</option>
            {BREAKDOWN_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </SelectField>
        )}

        {shown.has('toLocationId') && (
          <LocationSelectField
            {...field('toLocationId')}
            label="Ubicación de destino"
            locations={locations}
            excludeId={equipment.locationId}
            retryAction={retryButton('toLocationId', onRetryLocations)}
          />
        )}

        {shown.has('replacementEquipmentId') && (
          <SelectField
            {...field('replacementEquipmentId')}
            label="Equipo de reemplazo"
            optional
            disabled={replacements.status !== 'success'}
            hint={replacements.status === 'error' ? REPLACEMENTS_ERROR : undefined}
            action={
              replacements.status === 'error'
                ? retryButton('replacementEquipmentId', onRetryReplacements)
                : undefined
            }
          >
            <option value="">
              {replacements.status === 'loading'
                ? 'Cargando equipos…'
                : replacements.status === 'error'
                  ? REPLACEMENTS_ERROR
                  : 'Sin reemplazo'}
            </option>
            {candidates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name}
              </option>
            ))}
          </SelectField>
        )}

        {shown.has('technician') && (
          <TextField {...field('technician')} label="Técnico" optional autoComplete="off" />
        )}

        {shown.has('cost') && (
          <TextField
            {...field('cost')}
            label="Costo"
            optional
            inputMode="decimal"
            autoComplete="off"
            hint="En pesos, por ejemplo 15000,50."
          />
        )}
      </div>

      <TextAreaField
        {...field('description')}
        label={values.type === 'RETIREMENT' ? 'Motivo' : 'Descripción'}
      />

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={primaryButton} disabled={saving}>
          {saving ? 'Registrando…' : 'Registrar evento'}
        </button>
        <Link to={cancelTo} state={cancelState} className={secondaryButton}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
