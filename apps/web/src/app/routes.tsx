import { Navigate, type RouteObject } from 'react-router';

import { EquipmentDetailPage } from '../features/equipment/EquipmentDetailPage';
import { EquipmentEventFormPage } from '../features/equipment/EquipmentEventFormPage';
import { EquipmentCreatePage, EquipmentEditPage } from '../features/equipment/EquipmentFormPage';
import { EquipmentListPage } from '../features/equipment/EquipmentListPage';
import { LocationCreatePage, LocationEditPage } from '../features/equipment/LocationFormPage';
import { LocationListPage } from '../features/equipment/LocationListPage';
import { AppLayout } from './AppLayout';
import { PlaceholderPage } from './PlaceholderPage';

const BACK_TO_LIST = { to: '/equipos', label: 'Volver a equipos' };

/** Route table, shared by the browser router (`App`) and memory routers in tests. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/equipos" replace /> },
      { path: 'equipos', element: <EquipmentListPage /> },
      { path: 'equipos/nuevo', element: <EquipmentCreatePage /> },
      { path: 'equipos/:id', element: <EquipmentDetailPage /> },
      { path: 'equipos/:id/editar', element: <EquipmentEditPage /> },
      { path: 'equipos/:id/eventos/nuevo', element: <EquipmentEventFormPage /> },
      { path: 'ubicaciones', element: <LocationListPage /> },
      { path: 'ubicaciones/nuevo', element: <LocationCreatePage /> },
      { path: 'ubicaciones/:id/editar', element: <LocationEditPage /> },
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
