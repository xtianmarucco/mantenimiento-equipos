import { HealthStatus } from './features/health/HealthStatus';

export function App() {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="bg-teal-700 px-4 py-3 text-white shadow">
        <h1 className="text-lg font-semibold">Mantenimiento de Equipos</h1>
      </header>
      <main className="mx-auto w-full max-w-md space-y-4 p-4">
        <h2 className="text-sm font-medium tracking-wide text-slate-500 uppercase">
          Estado del sistema
        </h2>
        <HealthStatus />
      </main>
    </div>
  );
}
