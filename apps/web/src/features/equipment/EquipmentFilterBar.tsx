import {
  equipmentStatusSchema,
  equipmentTypeSchema,
  type EquipmentListQuery,
} from '@mantenimiento/shared';
import { useId, type ChangeEvent, type ReactNode } from 'react';

import type { ResourceState } from '../../shared/hooks/useResource';
import { focusRing } from '../../shared/ui/styles';
import { STATUS_FILTER_LABELS, TYPE_LABELS } from './labels';

export interface LocationOption {
  id: string;
  name: string;
}

interface EquipmentFilterBarProps {
  filters: EquipmentListQuery;
  locations: ResourceState<LocationOption[]>;
  /** Called with the next filters; a filter set back to its "all" option is `undefined`. */
  onChange: (filters: EquipmentListQuery) => void;
}

/** Presentational filter controls for the equipment list. */
export function EquipmentFilterBar({ filters, locations, onChange }: EquipmentFilterBarProps) {
  function update(key: keyof EquipmentListQuery) {
    return (event: ChangeEvent<HTMLSelectElement>) =>
      onChange({ ...filters, [key]: event.target.value || undefined });
  }

  return (
    <form
      role="search"
      aria-label="Filtros de equipos"
      className="grid gap-3 sm:grid-cols-3"
      onSubmit={(event) => event.preventDefault()}
    >
      <FilterSelect label="Estado" value={filters.status} onChange={update('status')}>
        <option value="">Todos los activos</option>
        {equipmentStatusSchema.options.map((status) => (
          <option key={status} value={status}>
            {STATUS_FILTER_LABELS[status]}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Ubicación"
        value={filters.locationId}
        onChange={update('locationId')}
        disabled={locations.status !== 'success'}
        hint={locations.status === 'error' ? 'No se pudieron cargar las ubicaciones.' : undefined}
      >
        <option value="">Todas las ubicaciones</option>
        {locations.status === 'success' &&
          locations.data.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
      </FilterSelect>

      <FilterSelect label="Tipo" value={filters.type} onChange={update('type')}>
        <option value="">Todos los tipos</option>
        {equipmentTypeSchema.options.map((type) => (
          <option key={type} value={type}>
            {TYPE_LABELS[type]}
          </option>
        ))}
      </FilterSelect>
    </form>
  );
}

interface FilterSelectProps {
  label: string;
  value: string | undefined;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  hint?: string | undefined;
  children: ReactNode;
}

function FilterSelect({ label, value, onChange, disabled, hint, children }: FilterSelectProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={onChange}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        className={`min-h-11 rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900 disabled:bg-slate-100 disabled:text-slate-600 ${focusRing}`}
      >
        {children}
      </select>
      {hint && (
        <p id={hintId} className="text-sm text-red-800">
          {hint}
        </p>
      )}
    </div>
  );
}
