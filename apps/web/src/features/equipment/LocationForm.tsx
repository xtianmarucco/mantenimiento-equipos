import { locationKindSchema } from '@mantenimiento/shared';
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';

import { errorBox, focusRing, primaryButton, secondaryButton } from '../../shared/ui/styles';
import { LOCATION_KIND_LABELS } from './labels';
import type {
  LocationFieldErrors,
  LocationFormError,
  LocationFormField,
  LocationFormValues,
} from './locationFormModel';

/** Asks the form to move focus; a new `seq` repeats the request for the same target. */
export interface LocationFocusRequest {
  target: LocationFormField | 'form';
  seq: number;
}

export interface LocationFormProps {
  mode: 'create' | 'edit';
  values: LocationFormValues;
  errors: LocationFieldErrors;
  formError: LocationFormError | undefined;
  saving: boolean;
  focusRequest: LocationFocusRequest | null;
  cancelTo: string;
  onChange: (field: LocationFormField, value: string) => void;
  onSubmit: () => void;
}

const CONTROL = `min-h-11 w-full rounded-md border bg-white px-3 py-2 text-slate-900 disabled:bg-slate-100 disabled:text-slate-600 ${focusRing}`;

function controlClass(invalid: boolean): string {
  return `${CONTROL} ${invalid ? 'border-red-700' : 'border-slate-400'}`;
}

/**
 * Presentational create/edit form for a location. Controlled: values, errors and the saving flag
 * come from the container, which validates and submits.
 */
export function LocationForm({
  mode,
  values,
  errors,
  formError,
  saving,
  focusRequest,
  cancelTo,
  onChange,
  onSubmit,
}: LocationFormProps) {
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

  function field(name: LocationFormField) {
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
      aria-label={mode === 'create' ? 'Nueva ubicación' : 'Editar ubicación'}
      className="space-y-4"
    >
      {formError && (
        <div ref={formErrorRef} role="alert" tabIndex={-1} className={`${errorBox} ${focusRing}`}>
          <p className="font-medium">{formError.message}</p>
          {formError.detail && <p className="mt-1 text-sm">Detalle: {formError.detail}</p>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField {...field('name')} label="Nombre" autoComplete="organization" />

        <SelectField {...field('kind')} label="Tipo">
          <option value="">Seleccione un tipo</option>
          {locationKindSchema.options.map((kind) => (
            <option key={kind} value={kind}>
              {LOCATION_KIND_LABELS[kind]}
            </option>
          ))}
        </SelectField>

        <TextField {...field('address')} label="Dirección" optional autoComplete="street-address" />
        <TextField {...field('contactName')} label="Contacto" optional autoComplete="name" />
        <TextField
          {...field('phone')}
          label="Teléfono"
          optional
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          hint="Entre 6 y 20 caracteres; puede incluir +, espacios, guiones y paréntesis."
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={primaryButton} disabled={saving}>
          {saving ? 'Guardando…' : mode === 'create' ? 'Crear ubicación' : 'Guardar cambios'}
        </button>
        <Link to={cancelTo} className={secondaryButton}>
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
  name: LocationFormField;
  label: string;
  value: string;
  error: string | undefined;
  onValue: (value: string) => void;
  optional?: boolean;
  hint?: string | undefined;
}

interface TextFieldProps extends BaseFieldProps {
  type?: 'text' | 'tel';
  inputMode?: 'tel';
  autoComplete?: string;
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
