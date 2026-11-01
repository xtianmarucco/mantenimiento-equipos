import type { HealthState } from './healthState';

const VIEW: Record<HealthState['status'], { label: string; detail: string; dot: string }> = {
  loading: {
    label: 'Comprobando conexión…',
    detail: 'Consultando el estado del servidor.',
    dot: 'bg-slate-400 animate-pulse',
  },
  ok: {
    label: 'API disponible',
    detail: 'El servidor responde correctamente.',
    dot: 'bg-emerald-500',
  },
  error: {
    label: 'API no disponible',
    detail: 'No se pudo conectar con el servidor. Intente de nuevo más tarde.',
    dot: 'bg-red-500',
  },
};

interface HealthStatusCardProps {
  state: HealthState;
}

/** Presentational card: renders the API health state, no data fetching. */
export function HealthStatusCard({ state }: HealthStatusCardProps) {
  const view = VIEW[state.status];

  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={`size-3 shrink-0 rounded-full ${view.dot}`} />
        <p className="font-medium text-slate-900">{view.label}</p>
      </div>
      <p className="mt-1 text-sm text-slate-600">{view.detail}</p>
    </section>
  );
}
