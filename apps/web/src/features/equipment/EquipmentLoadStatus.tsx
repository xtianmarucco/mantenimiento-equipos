import { Link } from 'react-router';

import { errorBox, textLink } from '../../shared/ui/styles';

/**
 * Presentational placeholder shown while one equipment item loads, when it does not exist and
 * when it could not be loaded.
 */
export function EquipmentLoadStatus({
  state,
  backTo,
}: {
  state: { status: 'loading' } | { status: 'not-found' } | { status: 'error' };
  backTo: string;
}) {
  if (state.status === 'loading') {
    return (
      <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-slate-700">
        Cargando equipo…
      </p>
    );
  }

  return (
    <section className="space-y-3">
      {state.status === 'not-found' ? (
        <>
          <h2 className="text-xl font-semibold">Equipo no encontrado</h2>
          <p className="text-slate-700">
            No existe un equipo con esa dirección. Puede haber sido un enlace incorrecto.
          </p>
        </>
      ) : (
        <p role="alert" className={errorBox}>
          No se pudo cargar el equipo. Intente de nuevo más tarde.
        </p>
      )}
      <Link to={backTo} className={textLink}>
        Volver a equipos
      </Link>
    </section>
  );
}
