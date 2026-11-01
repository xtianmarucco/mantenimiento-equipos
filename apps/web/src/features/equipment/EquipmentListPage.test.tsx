import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { routes } from '../../app/routes';
import {
  jsonResponse,
  LOCATION_CENTRO,
  LOCATION_KIOSCO,
  makeEquipment,
  requestedPaths,
  stubApi,
} from '../../test/fixtures';

function equipmentPaths(fetchMock: ReturnType<typeof stubApi>): string[] {
  return requestedPaths(fetchMock).filter((path) => path.startsWith('/api/equipment'));
}

function renderAt(path: string, equipment = () => jsonResponse([makeEquipment()])) {
  const fetchMock = stubApi({
    '/api/health': () => jsonResponse({ status: 'ok' }),
    '/api/equipment': equipment,
    '/api/locations': () => jsonResponse([LOCATION_CENTRO, LOCATION_KIOSCO]),
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  return { fetchMock, router, ...view };
}

describe('EquipmentListPage', () => {
  it('lists equipment with location names and links to create new equipment', async () => {
    renderAt('/equipos');

    const list = await screen.findByRole('list', { name: 'Equipos' });
    expect(within(list).getByRole('link', { name: /Freezer horizontal/ })).toHaveAttribute(
      'href',
      `/equipos/${makeEquipment().id}`,
    );
    expect(await within(list).findByText('Heladería Centro')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nuevo equipo' })).toHaveAttribute(
      'href',
      '/equipos/nuevo',
    );
  });

  it('fetches with the filters in the URL and shows them in the controls', async () => {
    const { fetchMock } = renderAt(`/equipos?status=RETIRED&locationId=${LOCATION_KIOSCO.id}`);

    await screen.findByRole('list', { name: 'Equipos' });
    expect(equipmentPaths(fetchMock)).toEqual([
      `/api/equipment?status=RETIRED&locationId=${LOCATION_KIOSCO.id}`,
    ]);
    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveValue('RETIRED');
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Ubicación' })).toHaveValue(LOCATION_KIOSCO.id),
    );
  });

  it('ignores invalid filter values in the URL', async () => {
    const { fetchMock } = renderAt('/equipos?status=BROKEN');

    await screen.findByRole('list', { name: 'Equipos' });
    expect(equipmentPaths(fetchMock)).toEqual(['/api/equipment']);
  });

  it('writes a filter change to the URL and refetches with it', async () => {
    const { fetchMock, router } = renderAt('/equipos?type=FREEZER');
    await screen.findByRole('list', { name: 'Equipos' });

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Estado' }),
      'Dados de baja',
    );

    await waitFor(() => expect(router.state.location.search).toBe('?status=RETIRED&type=FREEZER'));
    await waitFor(() =>
      expect(equipmentPaths(fetchMock)).toEqual([
        '/api/equipment?type=FREEZER',
        '/api/equipment?status=RETIRED&type=FREEZER',
      ]),
    );

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Estado' }),
      'Todos los activos',
    );
    await waitFor(() => expect(router.state.location.search).toBe('?type=FREEZER'));
  });

  it('shows the API error message when the list request fails', async () => {
    renderAt('/equipos', () =>
      jsonResponse({ error: { message: 'Internal server error' } }, { status: 500 }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se pudieron cargar los equipos.');
    expect(alert).toHaveTextContent('Internal server error');
  });

  it('opens the detail with a back link that keeps the list filters', async () => {
    const item = makeEquipment({ status: 'IN_REPAIR' });
    stubApi({
      '/api/health': () => jsonResponse({ status: 'ok' }),
      '/api/equipment': () => jsonResponse([item]),
      [`/api/equipment/${item.id}`]: () => jsonResponse(item),
      '/api/locations': () => jsonResponse([LOCATION_CENTRO]),
    });
    const router = createMemoryRouter(routes, {
      initialEntries: ['/equipos?status=IN_REPAIR&type=FREEZER'],
    });
    render(<RouterProvider router={router} />);

    await userEvent.click(await screen.findByRole('link', { name: /Freezer horizontal/ }));

    expect(await screen.findByRole('link', { name: 'Volver a equipos' })).toHaveAttribute(
      'href',
      '/equipos?status=IN_REPAIR&type=FREEZER',
    );
  });

  it('aborts pending requests on unmount', async () => {
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, _init?: RequestInit) => new Promise<Response>(() => {}),
    );
    vi.stubGlobal('fetch', fetchMock);
    const router = createMemoryRouter(routes, { initialEntries: ['/equipos'] });
    const { unmount } = render(<RouterProvider router={router} />);

    await waitFor(() => expect(equipmentPaths(fetchMock as never)).toHaveLength(1));
    const signals = fetchMock.mock.calls.map(([, init]) => init?.signal);
    expect(signals.every((signal) => signal instanceof AbortSignal && !signal.aborted)).toBe(true);

    unmount();

    expect(signals.every((signal) => signal?.aborted)).toBe(true);
  });
});
