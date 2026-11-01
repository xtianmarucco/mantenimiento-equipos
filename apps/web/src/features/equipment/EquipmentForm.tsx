import {
  equipmentStatusSchema,
  equipmentTypeSchema,
  locationKindSchema,
  type LocationResponse,
} from '@mantenimiento/shared';
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';

import type { ResourceState } from '../../shared/hooks/useResource';
import { errorBox, focusRing, primaryButton, secondaryButton } from '../../shared/ui/styles';
import type { EquipmentFormValues, FieldErrors, FormError, FormField } from './equipmentFormModel';
import { LOCATION_KIND_GROUP_LABELS, STATUS_LABELS, TYPE_LABELS } from './labels';
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
}

const CONTROL = `min-h-11 w-full rounded-md border bg-white px-3 py-2 text-slate-900 disabled:bg-slate-100 disabled:text-slate-600 ${focusRing}`;

function controlClass(invalid: boolean): string {
  return `${CONTROL} ${invalid ? 'border-red-700' : 'border-slate-400'}`;
}

/**
 * Presentational create/edit form. Controlled: values, errors and the saving flag come from the
 * container, which validates and submits. Native validation is off (`noValidate`) so every
 * message comes from the shared schemas, in Spanish.
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

        {mode === 'edit' && (
          <SelectField {...field('status')} label="Estado">
            {equipmentStatusSchema.options.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </SelectField>
        )}

        <TextField {...field('brand')} label="Marca" />
        <TextField {...field('model')} label="Modelo" />
        <TextField {...field('serialNumber')} label="Número de serie" optional />

        <TextField {...field('purchaseDate')} label="Fecha de compra" type="date" />
        <TextField {...field('warrantyUntil')} label="Garantía hasta" type="date" optional />

        <SelectField
          {...field('locationId')}
          label="Ubicación"
          disabled={locations.status !== 'success'}
          hint={locations.status === 'error' ? 'No se pudieron cargar las ubicaciones.' : undefined}
        >
          <option value="">
            {locations.status === 'loading' ? 'Cargando ubicaciones…' : 'Seleccione una ubicación'}
          </option>
          {locations.status === 'success' &&
            locationKindSchema.options.map((kind) => {
              const group = locations.data.filter((location) => location.kind === kind);
              return (
                group.length > 0 && (
                  <optgroup key={kind} label={LOCATION_KIND_GROUP_LABELS[kind]}>
                    {group.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </optgroup>
                )
              );
            })}
        </SelectField>
      </div>

      <FieldShell id={`${idPrefix}-notes`} label="Notas" optional error={errors.notes}>
        {(describedBy) => (
          <textarea
            id={`${idPrefix}-notes`}
            name="notes"
            rows={4}
            value={values.notes}
            onChange={(event) => onChange('notes', event.target.value)}
            aria-invalid={errors.notes ? true : undefined}
            aria-describedby={describedBy}
            className={controlClass(Boolean(errors.notes))}
          />
        )}
      </FieldShell>

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

interface FieldShellProps {
  id: string;
  label: string;
  optional?: boolean | undefined;
  hint?: string | undefined;
  error: string | undefined;
  /** Renders the control, given the ids that describe it (hint and error). */
  children: (describedBy: string | undefined) => ReactNode;
}

/** Label, control, hint and error message, wired with `aria-describedby`. */
function FieldShell({ id, label, optional, hint, error, children }: FieldShellProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
        {optional && (
          <>
            {' '}
            <span className="font-normal text-slate-600">(opcional)</span>
          </>
        )}
      </label>
      {children(describedBy)}
      {hint && (
        <p id={hintId} className="text-sm text-slate-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

interface BaseFieldProps {
  id: string;
  name: FormField;
  label: string;
  value: string;
  error: string | undefined;
  onValue: (value: string) => void;
  optional?: boolean;
  hint?: string | undefined;
}

interface TextFieldProps extends BaseFieldProps {
  type?: 'text' | 'date';
  autoCapitalize?: string;
  autoComplete?: string;
  spellCheck?: boolean;
}

function TextField({
  id,
  name,
  label,
  value,
  error,
  onValue,
  optional,
  hint,
  type = 'text',
  ...inputProps
}: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} optional={optional} hint={hint} error={error}>
      {(describedBy) => (
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={(event) => onValue(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={controlClass(Boolean(error))}
          {...inputProps}
        />
      )}
    </FieldShell>
  );
}

interface SelectFieldProps extends BaseFieldProps {
  disabled?: boolean;
  children: ReactNode;
}

function SelectField({
  id,
  name,
  label,
  value,
  error,
  onValue,
  optional,
  hint,
  disabled,
  children,
}: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} optional={optional} hint={hint} error={error}>
      {(describedBy) => (
        <select
          id={id}
          name={name}
          value={value}
          onChange={(event) => onValue(event.target.value)}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={controlClass(Boolean(error))}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}
