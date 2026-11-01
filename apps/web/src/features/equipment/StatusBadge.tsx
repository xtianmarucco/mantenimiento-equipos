import type { EquipmentStatus } from '@mantenimiento/shared';

import { STATUS_LABELS } from './labels';

const STATUS_STYLES: Record<EquipmentStatus, string> = {
  OPERATIONAL: 'bg-emerald-100 text-emerald-900 ring-emerald-700/30',
  IN_REPAIR: 'bg-amber-100 text-amber-900 ring-amber-700/30',
  OUT_OF_SERVICE: 'bg-red-100 text-red-900 ring-red-700/30',
  RETIRED: 'bg-slate-200 text-slate-800 ring-slate-700/30',
};

/** Equipment status as a labelled badge: the text carries the meaning, color only reinforces it. */
export function StatusBadge({ status }: { status: EquipmentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      <span className="sr-only">Estado: </span>
      <span>{STATUS_LABELS[status]}</span>
    </span>
  );
}
