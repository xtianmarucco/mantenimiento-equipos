import { Navigate, type RouteObject } from 'react-router';

import { EquipmentListPage } from '../features/equipment/EquipmentListPage';
import { AppLayout } from './AppLayout';
import { PlaceholderPage } from './PlaceholderPage';

const COMING_SOON = 'Próximamente: esta sección todavía está en desarrollo.';
const BACK_TO_LIST = { to: '/equipos', label: 'Volver a equipos' };

/** Route table, shared by the browser router (`App`) and memory routers in tests. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/equipos" replace /> },
      { path: 'equipos', element: <EquipmentListPage /> },
      // T6: equipment form.
      {
        path: 'equipos/nuevo',
        element: (
          <PlaceholderPage title="Nuevo equipo" message={COMING_SOON} backLink={BACK_TO_LIST} />
        ),
      },
      // T6: equipment detail.
      {
        path: 'equipos/:id',
        element: (
          <PlaceholderPage
            title="Detalle del equipo"
            message={COMING_SOON}
            backLink={BACK_TO_LIST}
          />
        ),
      },
      // T7: locations.
      {
        path: 'ubicaciones',
        element: <PlaceholderPage title="Ubicaciones" message={COMING_SOON} />,
      },
      {
        path: '*',
        element: (
          <PlaceholderPage
            title="Página no encontrada"
            message="La dirección no corresponde a ninguna sección de la aplicación."
            backLink={BACK_TO_LIST}
          />
        ),
      },
    ],
  },
];
