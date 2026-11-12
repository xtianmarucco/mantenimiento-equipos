import { locationKindSchema, type LocationResponse } from '@mantenimiento/shared';
import type { ReactNode } from 'react';

import type { ResourceState } from '../../shared/hooks/useResource';
import { focusRing } from '../../shared/ui/styles';
import { LOCATION_KIND_GROUP_LABELS } from './labels';

const CONTROL = `min-h-11 w-full rounded-md border bg-white px-3 py-2 text-slate-900 disabled:bg-slate-100 disabled:text-slate-600 ${focusRing}`;

/** Classes of a form control, with a red border when it is invalid. */
function controlClass(invalid: boolean): string {
  return `${CONTROL} ${invalid ? 'border-red-700' : 'border-slate-400'}`;
}

interface FieldShellProps {
  id: string;
  label: string;
  optional?: boolean | undefined;
  hint?: string | undefined;
  error: string | undefined;
  /** Renders the control, given the ids that describe it (hint and error). */
  children: (describedBy: string | undefined) => ReactNode;
  /** Optional action rendered with the field, e.g. a retry affordance under the hint/error. */
  action?: ReactNode;
}

/** Label, control, hint and error message, wired with `aria-describedby`. */
export function FieldShell({
  id,
  label,
  optional,
  hint,
  error,
  children,
  action,
}: FieldShellProps) {
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
      {action}
    </div>
  );
}

interface BaseFieldProps {
  id: string;
  name: string;
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
  inputMode?: 'decimal';
  /** Latest date accepted by a `date` input, `YYYY-MM-DD`. */
  max?: string;
}

export function TextField({
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
  action?: ReactNode;
}

export function SelectField({
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
  action,
}: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} optional={optional} hint={hint} error={error} action={action}>
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

interface TextAreaFieldProps extends BaseFieldProps {
  rows?: number;
}

export function TextAreaField({
  id,
  name,
  label,
  value,
  error,
  onValue,
  optional,
  hint,
  rows = 4,
}: TextAreaFieldProps) {
  return (
    <FieldShell id={id} label={label} optional={optional} hint={hint} error={error}>
      {(describedBy) => (
        <textarea
          id={id}
          name={name}
          rows={rows}
          value={value}
          onChange={(event) => onValue(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={controlClass(Boolean(error))}
        />
      )}
    </FieldShell>
  );
}

/** Spanish copy when the locations list failed to load; the control stays disabled until retry. */
export const LOCATIONS_LOAD_ERROR = 'No se pudieron cargar las ubicaciones.';

interface LocationSelectFieldProps extends Omit<BaseFieldProps, 'hint'> {
  locations: ResourceState<LocationResponse[]>;
  /** A location left out of the options, e.g. the current one of a transfer. */
  excludeId?: string | undefined;
  /** Rendered with the field only while the locations failed to load, e.g. a retry button. */
  retryAction?: ReactNode;
}

/**
 * Location select grouped by kind; disabled until the locations load, with the load state in the
 * placeholder option (and the error also as a hint).
 */
export function LocationSelectField({
  locations,
  excludeId,
  retryAction,
  ...fieldProps
}: LocationSelectFieldProps) {
  const options =
    locations.status === 'success'
      ? locations.data.filter((location) => location.id !== excludeId)
      : [];
  return (
    <SelectField
      {...fieldProps}
      disabled={locations.status !== 'success'}
      hint={locations.status === 'error' ? LOCATIONS_LOAD_ERROR : undefined}
      action={locations.status === 'error' ? retryAction : undefined}
    >
      <option value="">
        {locations.status === 'loading'
          ? 'Cargando ubicaciones…'
          : locations.status === 'error'
            ? LOCATIONS_LOAD_ERROR
            : 'Seleccione una ubicación'}
      </option>
      {locationKindSchema.options.map((kind) => {
        const group = options.filter((location) => location.kind === kind);
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
  );
}
