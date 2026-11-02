import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { routes } from '../../app/routes';
import {
  jsonResponse,
  LOCATION_CENTRO,
  LOCATION_KIOSCO,
  requestedPaths,
  stubApi,
} from '../../test/fixtures';

function renderAt(
  path: string,
  locations = () => jsonResponse([LOCATION_CENTRO, LOCATION_KIOSCO]),
) {
  const fetchMock = stubApi({
    '/api/health': () => jsonResponse({ status: 'ok' }),
    '/api/locations': locations,
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  return { fetchMock, router, ...view };
}

describe('LocationListPage', () => {
  it('lists locations and links to create a new one', async () => {
    renderAt('/ubicaciones');

    const list = await screen.findByRole('list', { name: 'Ubicaciones' });
    expect(within(list).getByRole('link', { name: /Heladería Centro/ })).toHaveAttribute(
      'href',
      `/ubicaciones/${LOCATION_CENTRO.id}/editar`,
    );
    expect(await within(list).findByText('Kiosco Plaza')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nueva ubicación' })).toHaveAttribute(
      'href',
      '/ubicaciones/nuevo',
    );
  });

  it('fetches the locations list', async () => {
    const { fetchMock } = renderAt('/ubicaciones');

    await screen.findByRole('list', { name: 'Ubicaciones' });
    expect(requestedPaths(fetchMock).filter((path) => path.startsWith('/api/locations'))).toEqual([
      '/api/locations',
    ]);
  });

  it('shows the API error message when the list request fails', async () => {
    renderAt('/ubicaciones', () =>
      jsonResponse({ error: { message: 'Internal server error' } }, { status: 500 }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se pudieron cargar las ubicaciones.');
    expect(alert).toHaveTextContent('Internal server error');
  });
});
