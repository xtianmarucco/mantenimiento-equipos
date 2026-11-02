import { NavLink, Outlet } from 'react-router';

import { HealthStatus } from '../features/health/HealthStatus';
import { focusRing } from '../shared/ui/styles';

const NAV_ITEMS = [
  { to: '/equipos', label: 'Equipos' },
  { to: '/ubicaciones', label: 'Ubicaciones' },
] as const;

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const state = isActive ? 'bg-white text-teal-800' : 'text-white hover:bg-teal-600';
  return `rounded-md px-3 py-2 text-sm font-medium ${state} ${focusRing} focus-visible:outline-white`;
}

/** App shell: header with title and main navigation, the routed page, and the API status. */
export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
      <header className="bg-teal-700 text-white shadow">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <h1 className="text-lg font-semibold">Mantenimiento de Equipos</h1>
          <nav aria-label="Principal">
            <ul className="flex gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} className={navLinkClass}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 p-4">
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-3xl p-4">
        <h2 className="mb-2 text-sm font-medium tracking-wide text-slate-600 uppercase">
          Estado del sistema
        </h2>
        <HealthStatus />
      </footer>
    </div>
  );
}
