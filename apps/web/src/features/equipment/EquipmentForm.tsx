import { equipmentTypeSchema, type LocationResponse } from '@mantenimiento/shared';
import { useEffect, useId, useRef, type FormEvent } from 'react';
import { Link } from 'react-router';

import type { ResourceState } from '../../shared/hooks/useResource';
import { errorBox, focusRing, primaryButton, secondaryButton } from '../../shared/ui/styles';
import type { EquipmentFormValues, FieldErrors, FormError, FormField } from './equipmentFormModel';
import { LocationSelectField, SelectField, TextAreaField, TextField } from './FormFields';
import { TYPE_LABELS } from './labels';
import type { EquipmentNavigationState } from './navigation';

/** Asks the form to move focus; a new `seq` repeats the request for the same target. */
export interface FocusRequest {
  target: FormField | 'form';
  seq: number;
}

export interface EquipmentFormProps {
  mode: 'create' | 'edit';
  values: EquipmentFormValues;
  errors: FieldErrors;
  formError: FormError | undefined;
  locations: ResourceState<LocationResponse[]>;
  saving: boolean;
  focusRequest: FocusRequest | null;
  cancelTo: string;
  cancelState?: EquipmentNavigationState | undefined;
  onChange: (field: FormField, value: string) => void;
  onSubmit: () => void;
  /** Retries the locations request; offered only while the locations state is `error`. */
  onRetryLocations?: (() => void) | undefined;
}

/**
 * Presentational create/edit form. Controlled: values, errors and the saving flag come from the
 * container, which validates and submits. Native validation is off (`noValidate`) so every
 * message comes from the shared schemas, in Spanish. The location is set on create only (the API
 * defaults the status); after that both change through events, so the edit form has neither.
 */
export function EquipmentForm({
  mode,
  values,
  errors,
  formError,
  locations,
  saving,
  focusRequest,
  cancelTo,
  cancelState,
  onChange,
  onSubmit,
  onRetryLocations,
}: EquipmentFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId();

  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.target === 'form') {
      formErrorRef.current?.focus();
      return;
    }
    const control = formRef.current?.elements.namedItem(focusRequest.target);
    if (control instanceof HTMLElement) {
      control.focus();
    }
  }, [focusRequest]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saving) {
      onSubmit();
    }
  }

  // Props shared by every field: ids, value, change handler and error wiring.
  function field(name: FormField) {
    return {
      id: `${idPrefix}-${name}`,
      name,
      value: values[name],
      error: errors[name],
      onValue: (value: string) => onChange(name, value),
    };
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      aria-label={mode === 'create' ? 'Nuevo equipo' : 'Editar equipo'}
      className="space-y-4"
    >
      {formError && (
        <div ref={formErrorRef} role="alert" tabIndex={-1} className={`${errorBox} ${focusRing}`}>
          <p className="font-medium">{formError.message}</p>
          {formError.detail && <p className="mt-1 text-sm">Detalle: {formError.detail}</p>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          {...field('code')}
          label="Código"
          hint="2 a 4 letras, un guion y 4 dígitos, por ejemplo EQ-0042."
          autoCapitalize="characters"
          spellCheck={false}
          autoComplete="off"
        />
        <TextField {...field('name')} label="Nombre" autoComplete="off" />

        <SelectField {...field('type')} label="Tipo">
          <option value="">Seleccione un tipo</option>
          {equipmentTypeSchema.options.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type]}
            </option>
          ))}
        </SelectField>

        <TextField {...field('brand')} label="Marca" />
        <TextField {...field('model')} label="Modelo" />
        <TextField {...field('serialNumber')} label="Número de serie" optional />

        <TextField {...field('purchaseDate')} label="Fecha de compra" type="date" />
        <TextField {...field('warrantyUntil')} label="Garantía hasta" type="date" optional />

        {mode === 'create' && (
          <LocationSelectField
            {...field('locationId')}
            label="Ubicación"
            locations={locations}
            retryAction={
              onRetryLocations && (
                <button type="button" onClick={onRetryLocations} className={secondaryButton}>
                  Reintentar
                </button>
              )
            }
          />
        )}
      </div>

      {mode === 'edit' && (
        <p className="text-sm text-slate-600">
          El estado y la ubicación se cambian registrando un evento.
        </p>
      )}

      <TextAreaField {...field('notes')} label="Notas" optional />

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={primaryButton} disabled={saving}>
          {saving ? 'Guardando…' : mode === 'create' ? 'Crear equipo' : 'Guardar cambios'}
        </button>
        <Link to={cancelTo} state={cancelState} className={secondaryButton}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
